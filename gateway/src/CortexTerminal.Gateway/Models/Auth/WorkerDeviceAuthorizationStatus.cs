namespace CortexTerminal.Gateway.Models.Auth;

public enum WorkerDeviceAuthorizationStatus
{
    Pending = 0,
    Approved = 1,
    Redeemed = 2,
    Denied = 3,
    Expired = 4
}
