const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// 平台分配的端口 (给网页保活用的，可能是 8080)
const webPort = process.env.PORT || 3000; 

// --- 核心配置 ---
const UUID = process.env.UUID || "de04accx-1af7-4b13-90ce-64197351d4c6";
const ARGO_AUTH = process.env.ARGO_AUTH || ""; 
const XRAY_PORT = 8008; // Xray 内部端口 (绝对不能和平台的 webPort 一样)
let argoDomain = "正在连接 Cloudflare 隧道，请在1分钟后刷新...";

// 1. 网页服务 (专门应付平台的健康检查和输出节点信息)
const server = http.createServer((req, res) => {
    if (req.url === '/node') {
        const displayDomain = ARGO_AUTH !== "" ? "固定域名(请使用你绑定的CF域名)" : argoDomain;
        const vlessLink = `vless://${UUID}@${displayDomain}:443?encryption=none&security=tls&type=ws&host=${displayDomain}&path=%2Fvl#Argo_Node`;
        
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        if (argoDomain.includes("trycloudflare.com") || ARGO_AUTH !== "") {
            res.end(`--- Argo Xray (防冲突稳定版) ---\n状态: 运行正常\n域名: ${displayDomain}\nUUID: ${UUID}\n\n节点链接 (请直接复制使用，不要改端口和TLS):\n${vlessLink}`);
        } else {
            res.end(`隧道启动中...\n状态: ${argoDomain}`);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="text-align:center;padding-top:100px;"><h1>404 Not Found</h1></body></html>`);
    }
});

server.listen(webPort, () => {
    console.log(`Web UI 启动在端口: ${webPort}`);
    startCore();
});

// 2. 核心启动逻辑
function startCore() {
    // 写入 Xray 配置 (绑定到内部安全端口 8008)
    const config = {
        inbounds: [{
            port: XRAY_PORT, 
            listen: "127.0.0.1",
            protocol: "vless",
            settings: { clients: [{ id: UUID }], decryption: "none" },
            streamSettings: { network: "ws", wsSettings: { path: "/vl" } }
        }],
        outbounds: [{ protocol: "freedom" }]
    };
    fs.writeFileSync('config.json', JSON.stringify(config));

    // 下载
    const setup = `curl -L -s https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o xray.zip && unzip -o xray.zip && chmod +x xray && curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cf && chmod +x cf`;

    exec(setup, (err) => {
        if (err) return console.log("下载核心失败");
        
        // 启动 Xray
        spawn('./xray', ['-c', 'config.json'], { stdio: 'ignore', detached: true }).unref();

        // 启动隧道，目标指向内部的 8008 端口
        let args = ['tunnel', '--url', `http://127.0.0.1:${XRAY_PORT}`, '--no-autoupdate'];
        if (ARGO_AUTH) {
            if (ARGO_AUTH.includes('{')) {
                fs.writeFileSync('tunnel.json', ARGO_AUTH);
                args = ['tunnel', '--no-autoupdate', 'run', '--cred-file', 'tunnel.json'];
            } else {
                args = ['tunnel', '--no-autoupdate', 'run', '--token', ARGO_AUTH];
            }
        }

        const cf = spawn('./cf', args);
        cf.stderr.on('data', (data) => {
            const log = data.toString();
            if (log.includes('.trycloudflare.com')) {
                const match = log.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/i);
                if (match) argoDomain = match[1];
            }
        });
    });
}
