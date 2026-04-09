using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using CommunityToolkit.Maui.Alerts;
using CommunityToolkit.Maui.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Plugin.Maui.Audio;
using CortexTerminal.MobileShell.Options;
using AudioEncoding = Plugin.Maui.Audio.Encoding;

namespace CortexTerminal.MobileShell.Services;

public sealed class NativeCapabilityBridge(
    IAudioManager audioManager,
    IOptions<StartupConfigOptions> startupConfigOptions,
    ILogger<NativeCapabilityBridge> logger)
{
    private sealed record AlertResult(bool Confirmed);
    private sealed record FilesResult(bool Cancelled, object[] Files);
    private sealed record AudioRecordingStartResult(bool Success, bool AlreadyRecording = false, string? FileName = null);
    private sealed record FilePayloadResult(string FileName, string ContentType, long Size, string Base64, long? DurationMs = null);
    private sealed record StartupConfigPayload(
        [property: JsonPropertyName("platform")] string Platform,
        [property: JsonPropertyName("isNativeShell")] bool IsNativeShell,
        [property: JsonPropertyName("useHashRouter")] bool UseHashRouter,
        [property: JsonPropertyName("gatewayUrl")] string GatewayUrl,
        [property: JsonPropertyName("appVersion")] string AppVersion,
        [property: JsonPropertyName("appBuild")] string AppBuild);

    private readonly JsonSerializerOptions jsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    private readonly StartupConfigOptions startupConfig = startupConfigOptions.Value;

    private IAudioRecorder? audioRecorder;
    private Stopwatch? recordingStopwatch;

    public Task<string> ShowToastAsync(string message)
    {
        return ExecuteSafeVoidAsync(() =>
            MainThread.InvokeOnMainThreadAsync(() =>
                Toast.Make(message, ToastDuration.Short).Show()));
    }

    public Task<string> ShowAlertAsync(
        string title,
        string message,
        string accept = "确定",
        string cancel = "")
    {
        return ExecuteSafeAsync(async () =>
        {
            var confirmed = await MainThread.InvokeOnMainThreadAsync(async () =>
            {
                var page = GetActivePage();

                if (string.IsNullOrWhiteSpace(cancel))
                {
                    await page.DisplayAlertAsync(title, message, accept);
                    return true;
                }

                return await page.DisplayAlertAsync(title, message, accept, cancel);
            });

            return new AlertResult(confirmed);
        });
    }

    public Task<string> PickFilesAsync()
    {
        return ExecuteSafeAsync<FilesResult>(async () =>
        {
            var results = await MainThread.InvokeOnMainThreadAsync(() =>
                FilePicker.Default.PickMultipleAsync(new PickOptions
                {
                    PickerTitle = "选择文件上传到 Cortex Terminal"
                }));

            if (results is null)
            {
                return new FilesResult(true, Array.Empty<object>());
            }

            var pickedFiles = results.OfType<FileResult>().ToArray();

            if (pickedFiles.Length == 0)
            {
                return new FilesResult(true, Array.Empty<object>());
            }

            var payloads = new List<object>(pickedFiles.Length);

            foreach (var file in pickedFiles)
            {
                payloads.Add(await BuildFilePayloadAsync(file));
            }

            return new FilesResult(false, payloads.ToArray());
        });
    }

    public Task<string> CopyTextAsync(string text)
    {
        return ExecuteSafeVoidAsync(() => Clipboard.Default.SetTextAsync(text ?? string.Empty));
    }

    public Task<string> ShareTextAsync(string title, string text)
    {
        return ExecuteSafeVoidAsync(() => Share.Default.RequestAsync(new ShareTextRequest
        {
            Title = string.IsNullOrWhiteSpace(title) ? "分享安装命令" : title,
            Subject = string.IsNullOrWhiteSpace(title) ? "分享安装命令" : title,
            Text = text ?? string.Empty
        }));
    }

    public Task<string> GetStartupConfigAsync()
    {
        return ExecuteSafeAsync(() => Task.FromResult(CreateStartupConfigPayload()));
    }

    public object CreateStartupConfigSnapshot()
    {
        return CreateStartupConfigPayload();
    }

    public Task<string> StartAudioRecordingAsync()
    {
        return ExecuteSafeAsync<AudioRecordingStartResult>(async () =>
        {
            var permission = await Permissions.RequestAsync<Permissions.Microphone>();

            if (permission != PermissionStatus.Granted)
            {
                throw new InvalidOperationException("需要麦克风权限才能开始录音。");
            }

            if (audioRecorder is { IsRecording: true })
            {
                return new AudioRecordingStartResult(true, true);
            }

            audioRecorder = audioManager.CreateRecorder(new AudioRecorderOptions
            {
                SampleRate = 44100,
                Channels = ChannelType.Mono,
                BitDepth = BitDepth.Pcm16bit,
                Encoding = AudioEncoding.Wav,
                ThrowIfNotSupported = false
            });

            if (!audioRecorder.CanRecordAudio)
            {
                throw new InvalidOperationException("当前设备或平台不支持音频录制。");
            }

            var fileName = $"cortex-recording-{DateTime.UtcNow:yyyyMMdd-HHmmss}.wav";
            var filePath = Path.Combine(FileSystem.CacheDirectory, fileName);

            await audioRecorder.StartAsync(filePath);
            recordingStopwatch = Stopwatch.StartNew();

            logger.LogInformation("Native audio recording started: {FilePath}", filePath);

            return new AudioRecordingStartResult(true, false, fileName);
        });
    }

    public Task<string> StopAudioRecordingAsync()
    {
        return ExecuteSafeAsync<object>(async () =>
        {
            if (audioRecorder is null || !audioRecorder.IsRecording)
            {
                return new FilesResult(true, Array.Empty<object>());
            }

            var recorder = audioRecorder;
            audioRecorder = null;

            var audioSource = await recorder.StopAsync();
            recordingStopwatch?.Stop();
            var durationMs = recordingStopwatch?.ElapsedMilliseconds ?? 0;
            recordingStopwatch = null;

            if (audioSource is not FileAudioSource fileAudioSource)
            {
                return new FilesResult(true, Array.Empty<object>());
            }

            var filePath = fileAudioSource.GetFilePath();
            var payload = await BuildFilePayloadAsync(
                filePath,
                Path.GetFileName(filePath),
                ResolveContentType(filePath),
                durationMs);

            TryDeleteFile(filePath);
            logger.LogInformation("Native audio recording finished: {FilePath}", filePath);

            return payload;
        });
    }

    private async Task<string> ExecuteSafeAsync<T>(
        Func<Task<T>> operation,
        [CallerMemberName] string operationName = "")
    {
        try
        {
            logger.LogInformation("Native bridge start: {Operation}", operationName);
            var result = await operation();
            return JsonSerializer.Serialize(result, jsonSerializerOptions);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Native bridge failed: {Operation}", operationName);
            return JsonSerializer.Serialize(new
            {
                error = exception.Message
            }, jsonSerializerOptions);
        }
    }

    private Task<string> ExecuteSafeVoidAsync(
        Func<Task> operation,
        [CallerMemberName] string operationName = "")
    {
        return ExecuteSafeAsync(async () =>
        {
            await operation();
            return new { success = true };
        }, operationName);
    }

    private static Page GetActivePage()
    {
        var page = Microsoft.Maui.Controls.Application.Current?.Windows.FirstOrDefault()?.Page
            ?? throw new InvalidOperationException("Unable to resolve the active page for the mobile shell.");

        while (true)
        {
            switch (page)
            {
                case Shell shell when shell.CurrentPage is not null:
                    page = shell.CurrentPage;
                    continue;
                case NavigationPage navigationPage when navigationPage.CurrentPage is not null:
                    page = navigationPage.CurrentPage;
                    continue;
                default:
                    return page;
            }
        }
    }

    private StartupConfigPayload CreateStartupConfigPayload()
    {
        var appVersion = AppInfo.Current.VersionString?.Trim();
        var appBuild = AppInfo.Current.BuildString?.Trim();

        return new StartupConfigPayload(
            GetPlatformName(),
            startupConfig.IsNativeShell,
            startupConfig.UseHashRouter,
            startupConfig.GatewayUrl,
            string.IsNullOrWhiteSpace(appVersion) ? "unknown" : appVersion,
            string.IsNullOrWhiteSpace(appBuild) ? "0" : appBuild);
    }

    private static async Task<FilePayloadResult> BuildFilePayloadAsync(FileResult fileResult)
    {
        using var sourceStream = await fileResult.OpenReadAsync();
        using var memoryStream = new MemoryStream();
        await sourceStream.CopyToAsync(memoryStream);

        var bytes = memoryStream.ToArray();
        return new FilePayloadResult(
            fileResult.FileName,
            string.IsNullOrWhiteSpace(fileResult.ContentType)
                ? ResolveContentType(fileResult.FileName)
                : fileResult.ContentType,
            bytes.LongLength,
            Convert.ToBase64String(bytes));
    }

    private static async Task<FilePayloadResult> BuildFilePayloadAsync(
        string filePath,
        string fileName,
        string contentType,
        long? durationMs = null)
    {
        await using var sourceStream = File.OpenRead(filePath);
        using var memoryStream = new MemoryStream();
        await sourceStream.CopyToAsync(memoryStream);

        var bytes = memoryStream.ToArray();

        return new FilePayloadResult(
            fileName,
            contentType,
            bytes.LongLength,
            Convert.ToBase64String(bytes),
            durationMs);
    }

    private static string ResolveContentType(string fileName)
    {
        return Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".wav" => "audio/wav",
            ".m4a" => "audio/mp4",
            ".aac" => "audio/aac",
            ".mp3" => "audio/mpeg",
            ".json" => "application/json",
            ".md" => "text/markdown",
            ".txt" => "text/plain",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };
    }

    private static string GetPlatformName()
    {
#if ANDROID
        return "android";
#elif IOS
        return "ios";
#elif MACCATALYST
        return "maccatalyst";
#elif WINDOWS
        return "windows";
#else
        return "unknown";
#endif
    }

    private static void TryDeleteFile(string filePath)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
        catch
        {
            // Best effort cleanup only.
        }
    }
}