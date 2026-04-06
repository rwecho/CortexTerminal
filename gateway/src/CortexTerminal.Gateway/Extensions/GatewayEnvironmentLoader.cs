namespace CortexTerminal.Gateway.Extensions;

public static class GatewayEnvironmentLoader
{
    public static void LoadFromRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                DotNetEnv.Env.Load(candidate);
                return;
            }

            directory = directory.Parent;
        }
    }
}
