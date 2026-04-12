using CortexTerminal.Worker.Services.Sessions;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerWorkingDirectoryResolverTests
{
    [Fact]
    public void ExpandHomeDirectory_WithTilde_ReturnsUserProfile()
    {
        var expected = Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));

        var actual = WorkerWorkingDirectoryResolver.ExpandHomeDirectory("~");

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void ExpandHomeDirectory_WithNestedPath_ResolvesUnderUserProfile()
    {
        var expected = Path.GetFullPath(
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "workspace",
                "CortexTerminal"));

        var actual = WorkerWorkingDirectoryResolver.ExpandHomeDirectory("~/workspace/CortexTerminal");

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Resolve_WithTrailingSpacePath_PreservesSignificantWhitespace()
    {
        var tempDirectory = Path.Combine(
            Path.GetTempPath(),
            $"cortex-terminal-trailing-space-{Guid.NewGuid():N}") + " ";

        Directory.CreateDirectory(tempDirectory);

        try
        {
            var resolved = WorkerWorkingDirectoryResolver.Resolve(
                tempDirectory,
                [Path.GetFullPath(tempDirectory)],
                "worker-test");

            Assert.Equal(Path.GetFullPath(tempDirectory), resolved);
        }
        finally
        {
            if (Directory.Exists(tempDirectory))
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
        }
    }
}
