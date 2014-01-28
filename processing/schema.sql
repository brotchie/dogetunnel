-- Accounts Table

-- Dogecoin Network
--CREATE DOMAIN doge_public_address AS varchar(40) NOT NULL CHECK (VALUE ~ 'D[1-9A-HJ-NP-Za-km-z]{20,40}');

-- TestNet
CREATE DOMAIN doge_public_address AS varchar(40) NOT NULL CHECK (VALUE ~ 'n[1-9A-HJ-NP-Za-km-z]{20,40}');
CREATE DOMAIN doge_transaction AS varchar(64);

CREATE TABLE account (
    public_address doge_public_address PRIMARY KEY, -- Ensures valid dogecoin address.
    created timestamp NOT NULL DEFAULT now(),
    password_hash varchar(60) NOT NULL,             -- Maximum bcrypt hash length is 60 characters.
    ip_address text,
    email varchar(254) );                           -- IETF standard maximum email address length.
CREATE UNIQUE INDEX public_address_idx ON account(public_address);

-- Transaction Table

CREATE TYPE txstate AS ENUM ('unconfirmed', 'confirmed', 'credited', 'spent', 'complete', 'error');
CREATE TABLE transaction (
    public_address doge_public_address REFERENCES account(public_address),
    txid doge_transaction NOT NULL,
    vout bigint NOT NULL,
    created timestamp NOT NULL DEFAULT now(),
    confirmations integer NOT NULL,
    spent_txid doge_transaction,
    spent_confirmations integer,
    amount decimal NOT NULL,
    state txstate NOT NULL DEFAULT 'unconfirmed',
    PRIMARY KEY (public_address, txid, vout));
CREATE INDEX txid_idx ON transaction(txid);
CREATE INDEX state_idx ON transaction(state);

-- Transaction Audit Table

CREATE TABLE transaction_audit (
    public_address doge_public_address,
    txid doge_transaction,
    vout bigint,
    time timestamp NOT NULL DEFAULT now(),
    from_state txstate NOT NULL,
    to_state txstate NOT NULL,
    description text NOT NULL,
    FOREIGN KEY(public_address, txid, vout) REFERENCES transaction(public_address, txid, vout));

-- Balance Table

CREATE SEQUENCE balance_id_seq;
CREATE TYPE balance_state AS ENUM ('unconfirmed', 'confirmed', 'error');
CREATE TABLE balance (
    public_address doge_public_address REFERENCES account(public_address),
    txid doge_transaction,
    vout bigint,
    balance_id integer NOT NULL PRIMARY KEY DEFAULT nextval('balance_id_seq'),
    time timestamp NOT NULL DEFAULT now(),
    state balance_state NOT NULL DEFAULT 'unconfirmed',
    kbytes bigint NOT NULL);
ALTER SEQUENCE balance_id_seq OWNED BY balance.balance_id;

CREATE OR REPLACE FUNCTION get_balance(in_public_address doge_public_address) RETURNS numeric AS $$
    SELECT sum(kbytes) FROM balance WHERE public_address=$1;
$$ LANGUAGE sql;

-- State Transitions

-- Confirm

CREATE OR REPLACE FUNCTION transaction_confirm(in_public_address doge_public_address, in_txid doge_transaction, in_vout bigint, in_confirmations integer) RETURNS void AS $$
DECLARE
    REQUIRED_CONFIRMATIONS integer := 2;
    txrecord RECORD;
BEGIN
    SELECT state INTO txrecord FROM transaction WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction (%, %, %) not found', in_public_address, in_txid, in_vout;
    END IF;

    IF in_confirmations < required_confirmations THEN
        RAISE EXCEPTION 'Confirmations less than %', required_confirmations;
    END IF;

    IF txrecord.state != 'unconfirmed' THEN
        RAISE EXCEPTION 'Transaction not in unconfirmed state';
    END IF;

    INSERT INTO transaction_audit (public_address, txid, vout, from_state, to_state, description) VALUES (in_public_address, in_txid, in_vout, txrecord.state, 'confirmed', 'Transaction confirmed');
    UPDATE transaction SET state = 'confirmed', confirmations = in_confirmations WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
END;
$$ LANGUAGE plpgsql;

-- Credit
CREATE OR REPLACE FUNCTION transaction_credit(in_public_address doge_public_address, in_txid doge_transaction, in_vout bigint, multiplier decimal) RETURNS numeric AS $$
DECLARE
    txrecord RECORD;
    credited_kbytes numeric;
BEGIN
    SELECT state, amount INTO txrecord FROM transaction WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction (%, %, %) not found', in_public_address, in_txid, in_vout;
    END IF;

    IF txrecord.state != 'confirmed' THEN
        RAISE EXCEPTION 'Transaction not in confirmed state';
    END IF;

    credited_kbytes := multiplier * txrecord.amount;

    INSERT INTO transaction_audit (public_address, txid, vout, from_state, to_state, description)
        VALUES (in_public_address, in_txid, in_vout, txrecord.state, 'credited', 'Credited account with ' || credited_kbytes || ' (' || txrecord.amount || ' DOGE at ' || multiplier || ' kB/DOGE)');
    UPDATE transaction SET state = 'credited' WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
    INSERT INTO balance (public_address, txid, vout, kbytes) VALUES (in_public_address, in_txid, in_vout, credited_kbytes);

    RETURN credited_kbytes;
END;
$$ LANGUAGE plpgsql;

-- Spend
CREATE OR REPLACE FUNCTION transaction_spend(in_public_address doge_public_address, in_txid doge_transaction, in_vout bigint, in_spent_txid doge_transaction) RETURNS void AS $$
DECLARE
    txrecord RECORD;
BEGIN
    SELECT state, amount INTO txrecord FROM transaction WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction (%, %, %) not found', in_public_address, in_txid, in_vout;
    END IF;

    IF txrecord.state != 'credited' THEN
        RAISE EXCEPTION 'Transaction not in credited state';
    END IF;

    INSERT INTO transaction_audit (public_address, txid, vout, from_state, to_state, description)
        VALUES (in_public_address, in_txid, in_vout, txrecord.state, 'spent', 'Spent ' || txrecord.amount || ' DOGE to cold wallet in transaction ' || in_spent_txid);
    UPDATE transaction SET state = 'spent', spent_txid=in_spent_txid, spent_confirmations=0 WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
END;
$$ LANGUAGE plpgsql;

-- Complete
CREATE OR REPLACE FUNCTION transaction_complete(in_public_address doge_public_address, in_txid doge_transaction, in_vout bigint, in_spent_confirmations integer) RETURNS void AS $$
DECLARE
    txrecord RECORD;
    REQUIRED_SPENT_CONFIRMATIONS integer := 3;
BEGIN
    SELECT state, amount, spent_txid INTO txrecord FROM transaction WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction (%, %, %) not found', in_public_address, in_txid, in_vout;
    END IF;

    IF txrecord.state != 'spent' THEN
        RAISE EXCEPTION 'Transaction not in spent state';
    END IF;

    IF in_spent_confirmations < REQUIRED_SPENT_CONFIRMATIONS THEN
        RAISE EXCEPTION 'Spent confirmations less than %', REQUIRED_SPENT_CONFIRMATIONS;
    END IF;

    INSERT INTO transaction_audit (public_address, txid, vout, from_state, to_state, description)
        VALUES (in_public_address, in_txid, in_vout, txrecord.state, 'complete', 'Completed ' || txrecord.amount || ' DOGE spend to cold wallet in transaction ' || txrecord.spent_txid || ' with ' || in_spent_confirmations || ' confirmations');
    UPDATE transaction SET state = 'complete', spent_confirmations=in_spent_confirmations WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
    UPDATE balance SET state='confirmed' WHERE txid=in_txid AND public_address=in_public_address AND vout=in_vout;
END;
$$ LANGUAGE plpgsql;

/*INSERT INTO account (password_hash, public_address) VALUES ('password', 'DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC');
INSERT INTO transaction (public_address, txid, vout, amount, confirmations) VALUES ('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 100, 1);
INSERT INTO transaction (public_address, txid, vout, amount, confirmations) VALUES ('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx2', 0, 100, 1);

SELECT transaction_confirm('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 1);
SELECT transaction_confirm('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 2);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_credit('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 2.5);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_spend('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 'coldtx');

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_complete('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC', 'tx1', 0, 3);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT get_balance('DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC');*/
