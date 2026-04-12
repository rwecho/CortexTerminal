using CortexTerminal.Worker.Services.Sessions;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerDirectoryBrowserTests
{
    [Fact]
    public async Task BrowseAsync_WithoutRequestedPath_ReturnsConfiguredRoots()
    {
        var root = Path.Combine(Path.GetTempPath(), $"cortex-terminal-root-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);

        try
        {
            var browser = new WorkerDirectoryBrowser("worker-test", [root]);

            var result = await browser.BrowseAsync(null, CancellationToken.None);

            Assert.Equal("worker-test", result.WorkerId);
            Assert.Null(result.RequestedPath);
            Assert.Single(result.Entries);
            Assert.Equal(Path.GetFullPath(root), result.Entries[0].Path);
            Assert.True(result.Entries[0].IsRoot);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task BrowseAsync_WithChildDirectory_ReturnsImmediateSubdirectories()
    {
        var root = Path.Combine(Path.GetTempPath(), $"cortex-terminal-root-{Guid.NewGuid():N}");
        var childA = Path.Combine(root, "child-a");
        var childB = Path.Combine(root, "child-b");
        Directory.CreateDirectory(childA);
        Directory.CreateDirectory(childB);

        try
        {
            var browser = new WorkerDirectoryBrowser("worker-test", [root]);

            var result = await browser.BrowseAsync(root, CancellationToken.None);

            Assert.Equal(Path.GetFullPath(root), result.RequestedPath);
            Assert.Equal(
                [Path.GetFullPath(childA), Path.GetFullPath(childB)],
                result.Entries.Select(entry => entry.Path).ToArray());
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task BrowseAsync_WithPathOutsideAllowedRoots_Throws()
    {
        var root = Path.Combine(Path.GetTempPath(), $"cortex-terminal-root-{Guid.NewGuid():N}");
        var outsider = Path.Combine(Path.GetTempPath(), $"cortex-terminal-outsider-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(outsider);

        try
        {
            var browser = new WorkerDirectoryBrowser("worker-test", [root]);

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                browser.BrowseAsync(outsider, CancellationToken.None));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
            Directory.Delete(outsider, recursive: true);
        }
    }
}
