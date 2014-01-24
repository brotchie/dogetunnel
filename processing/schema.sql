DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS transaction CASCADE;
DROP TABLE IF EXISTS transaction_audit CASCADE;
DROP TABLE IF EXISTS balance CASCADE;

-- Accounts Table

CREATE SEQUENCE account_id_seq;
CREATE TABLE account (
    account_id integer NOT NULL PRIMARY KEY DEFAULT nextval('account_id_seq'),
    created timestamp NOT NULL DEFAULT now(),
    password_hash varchar(60) NOT NULL,                    -- Maximum bcrypt hash length is 60 characters.
    ip_address inet,
    public_address varchar(40) CHECK 
        (public_address ~ 'D[1-9A-HJ-NP-Za-km-z]{20,40}'), -- Ensures valid dogecoin address.
    email varchar(254) );                                  -- IETF standard maximum email address length.
ALTER SEQUENCE account_id_seq OWNED BY account.account_id;
CREATE UNIQUE INDEX public_address_idx ON account(public_address);

-- Transaction Table

CREATE SEQUENCE transaction_id_seq;
CREATE TYPE txstate AS ENUM ('unconfirmed', 'confirmed', 'credited', 'spent', 'complete', 'error');
CREATE TABLE transaction (
    transaction_id integer NOT NULL PRIMARY KEY DEFAULT nextval('transaction_id_seq'),
    created timestamp NOT NULL DEFAULT now(),
    account_id integer NOT NULL references account(account_id),
    txid varchar(64) NOT NULL,
    confirmations integer NOT NULL,
    spent_txid varchar(64),
    spent_confirmations integer,
    amount decimal NOT NULL,
    state txstate NOT NULL DEFAULT 'unconfirmed');
ALTER SEQUENCE transaction_id_seq OWNED BY transaction.transaction_id;
CREATE INDEX txid_idx ON transaction(txid);
CREATE INDEX state_idx ON transaction(state);

-- Transaction Audit Table

CREATE TABLE transaction_audit (
    transaction_id integer NOT NULL references transaction(transaction_id),
    time timestamp NOT NULL DEFAULT now(),
    from_state txstate NOT NULL,
    to_state txstate NOT NULL,
    description text NOT NULL );

-- Balance Table

CREATE SEQUENCE balance_id_seq;
CREATE TYPE balance_state AS ENUM ('unconfirmed', 'confirmed', 'error');
CREATE TABLE balance (
    balance_id integer NOT NULL PRIMARY KEY DEFAULT nextval('balance_id_seq'),
    account_id integer NOT NULL references account(account_id),
    transaction_id integer references transaction(transaction_id),
    time timestamp NOT NULL DEFAULT now(),
    state balance_state NOT NULL DEFAULT 'unconfirmed',
    kbytes bigint NOT NULL);
ALTER SEQUENCE balance_id_seq OWNED BY balance.balance_id;

CREATE OR REPLACE FUNCTION get_balance_by_public_address(address varchar(40)) RETURNS numeric AS $$
    SELECT sum(kbytes) FROM balance WHERE account_id=(SELECT account_id from account WHERE public_address=$1);
$$ LANGUAGE sql;

-- State Transitions

-- Confirm

CREATE OR REPLACE FUNCTION transaction_confirm(id integer, new_confirmations integer) RETURNS void AS $$
DECLARE
    REQUIRED_CONFIRMATIONS integer := 2;
    txrecord RECORD;
BEGIN
    SELECT state INTO txrecord FROM transaction WHERE transaction_id=id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', id;
    END IF;

    IF new_confirmations < required_confirmations THEN
        RAISE EXCEPTION 'Confirmations less than %', required_confirmations;
    END IF;

    IF txrecord.state != 'unconfirmed' THEN
        RAISE EXCEPTION 'Transaction not in unconfirmed state';
    END IF;

    INSERT INTO transaction_audit (transaction_id, from_state, to_state, description) VALUES (id, txrecord.state, 'confirmed', 'Transaction confirmed');
    UPDATE transaction SET state = 'confirmed', confirmations = new_confirmations WHERE transaction_id=id;
END;
$$ LANGUAGE plpgsql;

-- Credit
CREATE OR REPLACE FUNCTION transaction_credit(id integer, multiplier decimal) RETURNS numeric AS $$
DECLARE
    txrecord RECORD;
    credited_kbytes numeric;
BEGIN
    SELECT state, account_id, amount INTO txrecord FROM transaction WHERE transaction_id=id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', id;
    END IF;

    IF txrecord.state != 'confirmed' THEN
        RAISE EXCEPTION 'Transaction not in confirmed state';
    END IF;

    credited_kbytes := multiplier * txrecord.amount;

    INSERT INTO transaction_audit (transaction_id, from_state, to_state, description)
        VALUES (id, txrecord.state, 'credited', 'Credited account with ' || credited_kbytes || ' (' || txrecord.amount || ' DOGE at ' || multiplier || ' kB/DOGE)');
    UPDATE transaction SET state = 'credited' WHERE transaction_id=id;
    INSERT INTO balance (transaction_id, account_id, kbytes) VALUES (id, txrecord.account_id, credited_kbytes);

    RETURN credited_kbytes;
END;
$$ LANGUAGE plpgsql;

-- Spend
CREATE OR REPLACE FUNCTION transaction_spend(id integer, in_spent_txid varchar(64)) RETURNS void AS $$
DECLARE
    txrecord RECORD;
BEGIN
    SELECT state, amount INTO txrecord FROM transaction WHERE transaction_id=id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', id;
    END IF;

    IF txrecord.state != 'credited' THEN
        RAISE EXCEPTION 'Transaction not in credited state';
    END IF;

    INSERT INTO transaction_audit (transaction_id, from_state, to_state, description)
        VALUES (id, txrecord.state, 'spent', 'Spent ' || txrecord.amount || ' DOGE to cold wallet in transaction ' || in_spent_txid);
    UPDATE transaction SET state = 'spent', spent_txid=in_spent_txid, spent_confirmations=0 WHERE transaction_id=id;
END;
$$ LANGUAGE plpgsql;

-- Complete
CREATE OR REPLACE FUNCTION transaction_complete(id integer, in_spent_confirmations integer) RETURNS void AS $$
DECLARE
    txrecord RECORD;
    REQUIRED_SPENT_CONFIRMATIONS integer := 3;
BEGIN
    SELECT state, amount, spent_txid INTO txrecord FROM transaction WHERE transaction_id=id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', id;
    END IF;

    IF txrecord.state != 'spent' THEN
        RAISE EXCEPTION 'Transaction not in spent state';
    END IF;

    IF in_spent_confirmations < REQUIRED_SPENT_CONFIRMATIONS THEN
        RAISE EXCEPTION 'Spent confirmations less than %', REQUIRED_SPENT_CONFIRMATIONS;
    END IF;

    INSERT INTO transaction_audit (transaction_id, from_state, to_state, description)
        VALUES (id, txrecord.state, 'complete', 'Completed ' || txrecord.amount || ' DOGE spend to cold wallet in transaction ' || txrecord.spent_txid || ' with ' || in_spent_confirmations || ' confirmations');
    UPDATE transaction SET state = 'complete', spent_confirmations=in_spent_confirmations WHERE transaction_id=id;
    UPDATE balance SET state='confirmed' WHERE transaction_id=id;
END;
$$ LANGUAGE plpgsql;


INSERT INTO account (password_hash, public_address) VALUES ('hash', 'D7mFXbQ2n9K8B9SM6q8nRd5nKwriycEz6n');
INSERT INTO transaction (account_id, txid, amount, confirmations) VALUES (1, 'tx1', 100, 1);

/*SELECT transaction_confirm(1, 1);
SELECT transaction_confirm(1, 2);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_credit(1, 2.5);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_spend(1, 'coldtx');

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;

SELECT transaction_complete(1, 3);

SELECT * FROM transaction;
SELECT * FROM balance;
SELECT * FROM transaction_audit;*/
