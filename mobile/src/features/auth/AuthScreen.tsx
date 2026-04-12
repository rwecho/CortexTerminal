import { Fingerprint } from "lucide-react";

type AuthScreenProps = {
  authMode: "login" | "register";
  authUsername: string;
  authPassword: string;
  authDisplayName: string;
  authEmail: string;
  authError: string | null;
  isAuthenticating: boolean;
  onAuthModeChange: (mode: "login" | "register") => void;
  onAuthUsernameChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onAuthDisplayNameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function AuthScreen({
  authMode,
  authUsername,
  authPassword,
  authDisplayName,
  authEmail,
  authError,
  isAuthenticating,
  onAuthModeChange,
  onAuthUsernameChange,
  onAuthPasswordChange,
  onAuthDisplayNameChange,
  onAuthEmailChange,
  onSubmit,
}: AuthScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-12 bg-black p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-600/30 bg-cyan-600/20">
          <Fingerprint size={48} className="text-cyan-500" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Cortex Terminal
          </h1>
          <p className="mt-1 text-sm text-gray-500">安全连接你的远程 AI 终端。</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="grid grid-cols-2 rounded-xl border border-[#222] bg-[#111] p-1">
          <button
            type="button"
            onClick={() => onAuthModeChange("login")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              authMode === "login" ? "bg-cyan-600 text-white" : "text-gray-400"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => onAuthModeChange("register")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              authMode === "register"
                ? "bg-cyan-600 text-white"
                : "text-gray-400"
            }`}
          >
            注册
          </button>
        </div>

        <div className="space-y-1">
          <label className="ml-2 text-[10px] font-bold uppercase text-gray-600">
            用户名
          </label>
          <input
            type="text"
            value={authUsername}
            onChange={(event) => onAuthUsernameChange(event.target.value)}
            placeholder="echo"
            className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-4 text-white outline-none transition-colors placeholder:text-gray-800 focus:border-cyan-600"
          />
        </div>

        <div className="space-y-1">
          <label className="ml-2 text-[10px] font-bold uppercase text-gray-600">
            密码
          </label>
          <input
            type="password"
            value={authPassword}
            onChange={(event) => onAuthPasswordChange(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-4 text-white outline-none transition-colors placeholder:text-gray-800 focus:border-cyan-600"
          />
          {authMode === "register" && (
            <p className="ml-2 text-[11px] text-gray-500">
              密码至少 8 位，且必须包含大写字母、小写字母和数字。
            </p>
          )}
        </div>

        {authMode === "register" && (
          <>
            <div className="space-y-1">
                <label className="ml-2 text-[10px] font-bold uppercase text-gray-600">
                  显示名称
                </label>
              <input
                type="text"
                value={authDisplayName}
                onChange={(event) =>
                  onAuthDisplayNameChange(event.target.value)
                }
                placeholder="Echo"
                className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-4 text-white outline-none transition-colors placeholder:text-gray-800 focus:border-cyan-600"
              />
            </div>

            <div className="space-y-1">
                <label className="ml-2 text-[10px] font-bold uppercase text-gray-600">
                  Email
                </label>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => onAuthEmailChange(event.target.value)}
                placeholder="echo@example.com"
                className="w-full rounded-xl border border-[#222] bg-[#111] px-4 py-4 text-white outline-none transition-colors placeholder:text-gray-800 focus:border-cyan-600"
              />
            </div>
          </>
        )}

        {authError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={isAuthenticating}
          className="w-full rounded-xl bg-cyan-600 py-4 font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#14313a] disabled:text-gray-400"
        >
          {isAuthenticating
            ? authMode === "login"
              ? "登录中..."
              : "创建账号中..."
            : authMode === "login"
              ? "登录并进入"
              : "注册并进入"}
        </button>
      </div>
    </div>
  );
}
