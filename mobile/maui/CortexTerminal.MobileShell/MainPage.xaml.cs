using System.Text.Json;
using CortexTerminal.MobileShell.Services;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.MobileShell;

public partial class MainPage : ContentPage
{
	private readonly NativeCapabilityBridge nativeCapabilityBridge;
	private readonly NativeManagementRealtimeService nativeManagementRealtimeService;
	private readonly ILogger<MainPage> logger;
	private CancellationTokenSource? loadingTimeoutCts;
	private bool isInitialized;
	private bool canNavigateBackInWebView;
	private string activeWebPath = "/";

	public MainPage(
		NativeCapabilityBridge nativeCapabilityBridge,
		NativeManagementRealtimeService nativeManagementRealtimeService,
		ILogger<MainPage> logger)
	{
		InitializeComponent();
		this.nativeCapabilityBridge = nativeCapabilityBridge;
		this.nativeManagementRealtimeService = nativeManagementRealtimeService;
		this.logger = logger;
		hybridWebView.SetInvokeJavaScriptTarget(nativeCapabilityBridge);
		this.nativeManagementRealtimeService.RawMessageReady += OnNativeManagementRawMessageReady;
	}

	protected override void OnAppearing()
	{
		base.OnAppearing();

		if (isInitialized)
		{
			return;
		}

		isInitialized = true;
		statusMessageLabel.Text = "正在挂载 Cortex Terminal shell...";
		StartLoadingTimeout();
	}

	protected override void OnDisappearing()
	{
		loadingTimeoutCts?.Cancel();
		loadingTimeoutCts = null;
		base.OnDisappearing();
	}

	protected override void OnHandlerChanging(HandlerChangingEventArgs args)
	{
		if (args.NewHandler is null)
		{
			nativeManagementRealtimeService.RawMessageReady -= OnNativeManagementRawMessageReady;
		}

		base.OnHandlerChanging(args);
	}

	protected override bool OnBackButtonPressed()
	{
		if (!canNavigateBackInWebView)
		{
			return base.OnBackButtonPressed();
		}

		MainThread.BeginInvokeOnMainThread(async () =>
		{
			try
			{
				await hybridWebView.EvaluateJavaScriptAsync("window.__cortexHandleNativeBack?.() ?? false;");
			}
			catch (Exception exception)
			{
				logger.LogWarning(exception, "Failed to dispatch native back press to HybridWebView for route {ActiveWebPath}.", activeWebPath);
			}
		});

		return true;
	}

	private void OnHybridWebViewLoaded(object? sender, EventArgs e)
	{
		statusMessageLabel.Text = "React terminal shell 已加载，等待 web app 初始化...";
	}

	private async void OnHybridWebViewRawMessageReceived(object? sender, HybridWebViewRawMessageReceivedEventArgs e)
	{
		if (string.IsNullOrWhiteSpace(e.Message))
		{
			return;
		}

		try
		{
			using var document = JsonDocument.Parse(e.Message);
			if (!document.RootElement.TryGetProperty("type", out var typeElement))
			{
				return;
			}

			var messageType = typeElement.GetString();

			switch (messageType)
			{
				case "appInit":
					await MainThread.InvokeOnMainThreadAsync(() =>
					{
						hybridWebView.SendRawMessage(JsonSerializer.Serialize(new
						{
							type = "initData",
							payload = nativeCapabilityBridge.CreateStartupConfigSnapshot()
						}));
						statusMessageLabel.Text = "正在初始化应用…";
					});
					break;
				case "appReady":
					await MainThread.InvokeOnMainThreadAsync(async () =>
					{
						loadingTimeoutCts?.Cancel();
						statusMessageLabel.Text = "正在进入工作台…";
						await loadingOverlay.FadeToAsync(0, 220, Easing.Linear);
						loadingOverlay.IsVisible = false;
						loadingIndicator.IsRunning = false;
					});
					break;
				case "navigationState":
					if (document.RootElement.TryGetProperty("payload", out var payloadElement))
					{
						canNavigateBackInWebView =
							payloadElement.TryGetProperty("canGoBack", out var canGoBackElement) &&
							canGoBackElement.ValueKind is JsonValueKind.True or JsonValueKind.False &&
							canGoBackElement.GetBoolean();

						activeWebPath =
							payloadElement.TryGetProperty("pathname", out var pathnameElement)
								? pathnameElement.GetString() ?? "/"
								: "/";
					}
					break;
			}
		}
		catch (JsonException)
		{
			// ignore malformed startup lifecycle messages
		}
	}

	private void StartLoadingTimeout()
	{
		loadingTimeoutCts?.Cancel();
		loadingTimeoutCts = new CancellationTokenSource();
		var token = loadingTimeoutCts.Token;

		Task.Run(async () =>
		{
			try
			{
				await Task.Delay(TimeSpan.FromSeconds(8), token);

				MainThread.BeginInvokeOnMainThread(() =>
				{
					if (!loadingOverlay.IsVisible)
					{
						return;
					}

					loadingIndicator.IsRunning = false;
					statusMessageLabel.Text = "HybridWebView 启动超时。请先执行 npm run build:maui-shell，或检查 wwwroot 资产是否已同步。";
				});
			}
			catch (TaskCanceledException)
			{
				// no-op
			}
		});
	}

	private void OnNativeManagementRawMessageReady(string message)
	{
		logger.LogInformation("[native-management] MainPage forwarding raw message into HybridWebView: {Message}", message);
		MainThread.BeginInvokeOnMainThread(async () =>
		{
			if (!isInitialized)
			{
				logger.LogWarning("[native-management] Dropping raw message because MainPage is not initialized yet.");
				return;
			}

			var encodedMessage = JsonSerializer.Serialize(message);
			await hybridWebView.EvaluateJavaScriptAsync(
				$"window.__dispatchCortexNativeManagementMessage?.({encodedMessage});");
		});
	}
}
