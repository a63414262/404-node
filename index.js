const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');

const webPort = process.env.PORT || 3000; 
const UUID = process.env.UUID || "de04acca-1af7-4b13-90ce-64197351d4c6";
const ARGO_AUTH = process.env.ARGO_AUTH || ""; 
const XRAY_PORT = 8008; 
let argoDomain = "正在连接 Cloudflare 隧道...";

// --- 内存日志系统 ---
const logs = [];
function addLog(module, msg) {
    const time = new Date().toISOString().split('T')[1].slice(0, 8); // 取出时分秒
    const line = `[${time}] [${module}] ${msg.trim()}`;
    console.log(line); // 打印到 PaaS 后台
    logs.push(line);   // 存入内存
    if (logs.length > 200) logs.shift(); // 只保留最新的 200 条，防止内存爆炸
}

// 1. 网页服务
const server = http.createServer((req, res) => {
    // 【新增功能】直接在网页看日志
    if (req.url === '/log') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`=== 系统实时日志 (最新200条) ===\n\n${logs.join('\n')}\n\n===========================\n提示: 刷新页面可获取最新日志。`);
        return;
    }

    if (req.url === '/node') {
        const displayDomain = ARGO_AUTH !== "" ? "固定域名(请使用你绑定的CF域名)" : argoDomain;
        const vlessLink = `vless://${UUID}@${displayDomain}:443?encryption=none&security=tls&type=ws&host=${displayDomain}&path=%2Fvl#Argo_Node`;
        
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        if (argoDomain.includes("trycloudflare.com") || ARGO_AUTH !== "") {
            res.end(`--- Argo Xray (调试排错版) ---\n状态: 运行正常\n域名: ${displayDomain}\nUUID: ${UUID}\n\n节点链接:\n${vlessLink}\n\n👉 想看运行日志？请访问: /log`);
        } else {
            res.end(`隧道启动中...\n状态: ${argoDomain}\n\n👉 迟迟不显示？请访问 /log 查看后台报错。`);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="text-align:center;padding-top:100px;"><h1>404 Not Found</h1></body></html>`);
    }
});

server.listen(webPort, () => {
    addLog('SYSTEM', `Web UI 启动在端口: ${webPort}`);
    startCore();
});

// 2. 核心启动逻辑
function startCore() {
    addLog('SYSTEM', '正在生成配置文件...');
    // 【新增功能】给 Xray 开启 debug 日志
    const config = {
        log: { loglevel: "debug" },
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

    addLog('SYSTEM', '正在下载二进制核心...');
    const setup = `curl -L -s https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o xray.zip && unzip -o xray.zip && chmod +x xray && curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cf && chmod +x cf`;

    exec(setup, (err) => {
        if (err) {
            addLog('ERROR', `下载核心失败: ${err.message}`);
            return;
        }
        addLog('SYSTEM', '下载完成，准备启动核心进程...');
        
        // 启动 Xray 并捕获所有输出
        const xrayProcess = spawn('./xray', ['-c', 'config.json']);
        xrayProcess.stdout.on('data', (data) => addLog('XRAY-INFO', data.toString()));
        xrayProcess.stderr.on('data', (data) => addLog('XRAY-WARN', data.toString()));
        xrayProcess.on('close', (code) => addLog('XRAY-EXIT', `进程异常退出，退出码: ${code}`));

        // 启动 Argo 隧道并捕获所有输出
        let args = ['tunnel', '--url', `http://127.0.0.1:${XRAY_PORT}`, '--no-autoupdate'];
        if (ARGO_AUTH) {
            if (ARGO_AUTH.includes('{')) {
                fs.writeFileSync('tunnel.json', ARGO_AUTH);
                args = ['tunnel', '--no-autoupdate', 'run', '--cred-file', 'tunnel.json'];
            } else {
                args = ['tunnel', '--no-autoupdate', 'run', '--token', ARGO_AUTH];
            }
        }

        const cfProcess = spawn('./cf', args);
        cfProcess.stdout.on('data', (data) => addLog('ARGO-INFO', data.toString()));
        cfProcess.stderr.on('data', (data) => {
            const log = data.toString();
            addLog('ARGO-LOG', log); // 记录所有 Argo 日志
            
            if (log.includes('.trycloudflare.com')) {
                const match = log.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/i);
                if (match) {
                    argoDomain = match[1];
                    addLog('SYSTEM', `成功抓取到隧道域名: ${argoDomain}`);
                }
            }
        });
        cfProcess.on('close', (code) => addLog('ARGO-EXIT', `隧道进程退出，退出码: ${code}`));
    });
}
