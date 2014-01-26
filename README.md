dogetunnel
==========

- `dogecoin-sim` JSON-RPC server that complies with the dogecoind RPC spec. We use this to mock dogecoind during system testing.
- `api` The public facing API for creating accounts, registering email addresses, and resetting passwords.
- `processing` The transaction processing daemon for polling the blockchain via dogecoind JSON-RPC, accounting for new transactions, and spending these transactions to the cold wallet.
