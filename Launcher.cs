using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace XingSeLauncher {
    static class Program {
        private const int PORT = 3721;
        private const string APP_URL = "http://127.0.0.1:3721";
        private const string APP_TITLE = "形色 XINGSE";

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string currentDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            Directory.SetCurrentDirectory(currentDir);

            // 1. 检查 Node.js 运行环境
            if (!IsNodeInstalled()) {
                DialogResult res = MessageBox.Show(
                    "未检测到 Node.js 运行环境！\n形色需要 Node.js (v18+) 来运行本地摄影导演与生图服务。\n\n是否立即前往 Node.js 官网 (https://nodejs.org) 下载安装？",
                    APP_TITLE + " - 环境检查",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning
                );
                if (res == DialogResult.Yes) {
                    Process.Start("https://nodejs.org");
                }
                return;
            }

            // 2. 检查后台服务是否已在运行，若未运行则启动
            Process nodeProcess = null;
            bool serverWasAlreadyRunning = IsPortOpen("127.0.0.1", PORT);

            if (!serverWasAlreadyRunning) {
                try {
                    string nodeExe = File.Exists(Path.Combine(currentDir, "node.exe")) ? Path.Combine(currentDir, "node.exe") : "node";
                    ProcessStartInfo nodePsi = new ProcessStartInfo {
                        FileName = nodeExe,
                        Arguments = "server.js",
                        WorkingDirectory = currentDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    nodeProcess = Process.Start(nodePsi);

                    // 等待服务端口 3721 就绪 (最多等 6 秒)
                    int waited = 0;
                    while (waited < 6000) {
                        Thread.Sleep(200);
                        waited += 200;
                        if (IsPortOpen("127.0.0.1", PORT)) break;
                    }
                } catch (Exception ex) {
                    MessageBox.Show("启动本地服务失败: " + ex.Message, APP_TITLE + " 错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            // 3. 寻找 Edge 或 Chrome 浏览器以独立应用模式启动
            string browserPath = FindBrowser();
            string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "XingSeStudio", "BrowserProfile");
            if (!Directory.Exists(profileDir)) {
                try { Directory.CreateDirectory(profileDir); } catch {}
            }

            Process browserProcess = null;
            try {
                if (!string.IsNullOrEmpty(browserPath)) {
                    // 使用独立的 user-data-dir 保证进程独立可追踪，窗口关闭时进程退出
                    string args = string.Format("--app={0} --window-size=1540,960 --user-data-dir=\"{1}\"", APP_URL, profileDir);
                    ProcessStartInfo bPsi = new ProcessStartInfo {
                        FileName = browserPath,
                        Arguments = args,
                        UseShellExecute = true
                    };
                    browserProcess = Process.Start(bPsi);
                } else {
                    // 降级使用系统默认浏览器
                    browserProcess = Process.Start(APP_URL);
                }
            } catch (Exception ex) {
                MessageBox.Show("唤起桌面视窗失败: " + ex.Message, APP_TITLE + " 错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }

            // 4. 监听视窗关闭生命周期：当主视窗关闭时，同步彻底关闭后台 Node 服务！
            if (browserProcess != null && !browserProcess.HasExited) {
                try {
                    browserProcess.WaitForExit();
                } catch {}
            }

            // 5. 清理后台进程（仅清理形色自身启动的进程）
            CleanupBackend(nodeProcess);
        }

        private static bool IsNodeInstalled() {
            if (File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node.exe"))) return true;
            try {
                ProcessStartInfo psi = new ProcessStartInfo {
                    FileName = "where",
                    Arguments = "node",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true
                };
                using (Process p = Process.Start(psi)) {
                    p.WaitForExit(2000);
                    return p.ExitCode == 0;
                }
            } catch {
                return false;
            }
        }

        private static bool IsPortOpen(string host, int port) {
            try {
                using (TcpClient client = new TcpClient()) {
                    IAsyncResult result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(200);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            } catch {
                return false;
            }
        }

        private static string FindBrowser() {
            string[] candidates = new string[] {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in candidates) {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        private static void CleanupBackend(Process spawnedNode) {
            try {
                // 如果是本启动器拉起的 Node，直接退出
                if (spawnedNode != null && !spawnedNode.HasExited) {
                    try {
                        spawnedNode.Kill();
                        spawnedNode.WaitForExit(1000);
                    } catch {}
                }

                // 安全查找并结束占用 3721 端口的服务进程
                ProcessStartInfo psi = new ProcessStartInfo {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"Get-Process node -ErrorAction SilentlyContinue | Where-Object { (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 3721) } | Stop-Process -Force\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                using (Process p = Process.Start(psi)) {
                    p.WaitForExit(3000);
                }
            } catch {}
        }
    }
}
