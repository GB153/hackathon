from algokit_utils import AlgorandClient, AccountManager
from algokit_utils.models.amount import AlgoAmount


def get_algorand_client() -> AlgorandClient:
    return AlgorandClient.default_localnet()


def get_account_manager() -> AccountManager:
    # v3: pass the ClientManager
    return AccountManager(client_manager=get_algorand_client().client)


def get_or_create_local_account(user_key: str):
    """
    Idempotently create/fetch a per-user account on LocalNet and fund it.
    No manual KMD API needed.
    """
    am = get_account_manager()
    # v3 'from_environment' will create a KMD wallet entry if needed and
    # ensure the account is funded via the LocalNet dispenser.
    return am.from_environment(
        name=user_key,  # stable id, e.g. email
        fund_with=AlgoAmount.from_algo(5),  # starter funds on LocalNet
    )


def get_dispenser_account():
    # Faucet account for admin/deploy txns
    return get_account_manager().localnet_dispenser()
