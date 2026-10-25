# 形色 XINGSE · 架构重构与深度缺陷消除开发者日记

> **记录时间**：2026-10-25  
> **版本里程碑**：v0.7.9  
> **核心主题**：真伪代码断层排查、消除测试假阳性、全量行为级验证通过、彻底杜绝跨平台串用与假保存  

---

## 📖 一、三次复核总结：从“形式化通过”到“生产代码实测闭环”

在持续的高强度对抗式复核中，我们坚决贯彻**「杜绝任何 mock 糊弄、杜绝任何假阳性、全生产代码直测」**的原则。第三轮复核针对审查者指出的 **Tauri 桌面端 Key 重启丢失、浏览器下载标记未传递、重试保存假成功、Node 写入失败返回 200、测试套件真实性不足** 等关键硬伤进行了全面加固。

---

## 🛠️ 二、第三轮深度加固明细

### 1. 🔴 彻底修复 Tauri 桌面版 API Key 重启后丢失的严重回归
* **问题本质**：上一轮为了防止浏览器 `localStorage` 泄漏明文 Key，在 `saveSettings` 中将 Key 从 `localStorage` 中剔除；但 Tauri 桌面端是纯本地单机运行且无 Node 服务端支撑，凭证依赖 `localStorage` 跨启动持久化，导致桌面用户重启软件后 Key 全部丢失。
* **彻底根治**：
  - 分环境处理：`if (this.isTauri())` 保留 `localStorage` 中的 Key 持久化；而在 Node 服务端模式下继续保持 localStorage 深度脱敏净化；
  - 桌面用户跨启动无感保存凭据，彻底杜绝重启丢配置。(`public/js/api.js` & `app.js`)

### 2. 🟠 浏览器下载状态向上传递到 UI
* **问题本质**：`saveLocalImage` 虽返回了 `isBrowserDownload: true`，但 `generateImage` 组装返回对象时遗漏了该字段，导致 UI 无法感知。
* **彻底根治**：
  - `generateImage` 返回对象中明确注入 `isBrowserDownload: isBrowserDownload`；
  - `app.js` 准确识别该标记，区分展示“图片已自动归档保存”与“已通过浏览器触发下载（未直接写入指定磁盘目录）”。(`public/js/api.js` & `app.js`)

### 3. 🟠 “重试保存”假成功提示与字段名兼容修复
* **问题本质**：重试保存按钮点击后未校验 `saveRes.success` 直接报成功；且只读取了 `savedFile`，Tauri 端返回的 `filename` 会被显示为 undefined。
* **彻底根治**：
  - 严谨校验 `if (saveRes && saveRes.success && saveRes.savedPath)`；
  - 兼容读取 `saveRes.savedFile || saveRes.filename`；失败时准确弹出错误原因。(`public/js/app.js`)

### 4. 🟠 Node 路由写入失败可感知闭环
* **问题本质**：`writeJson` 返回了 boolean 状态，但所有 API 路由均未检查，写入失败依然返回 200。
* **彻底根治**：
  - 在 `/api/settings`、`/api/history`、`/api/presets`、`/api/custom-options` 路由中，对 `writeJson(...)` 结果全面校验，若返回 false 立即返回 500 并明确报错提示，形成写入失败的可感知闭环。(`server.js`)

### 5. 质量遗漏对齐
* **七维签名历史遗留默认值对齐**：
  - `director.js:609` 中的 `'自信冷静'` -> `'自信'`、`'直视'` -> `'直视镜头'`、`'站立'` -> `'自然站立'`、`'三分法'` -> `'三分'`，全面对齐选项库；
* **测试套件全面升级为全生产代码直测**：
  - 彻底删除 `mockResolveKey` 和 `testProcessKeyForSave`，全部直接导入并测试生产导出的真实函数；
  - E2E HTTP 测试采用环境变量 `PORT: 3739` 与独立临时数据目录，断言失败显式调用 `process.exit(1)`，绝不污染用户真实生产数据。

---

## 🧪 三、全套自动化验证结果

```text
PASS: server.js
PASS: portable-classic/server.js
PASS: public/js/api.js
PASS: public/js/app.js
PASS: public/js/director.js
PASS: public/js/translations.js

Running behavior tests...
====================================================
       形色 XINGSE 生产函数真实行为测试套件 v2.0     
====================================================

✓ [1/6] 词典生产函数测试通过：31 项词汇全部通过生产 toEn() 转换，0 汉字残留
✓ [2/6] 随机抽样与分区联动测试通过：生产 isFieldPartitionActive 正确接收临时 selections
✓ [3/6] 跨 Provider Key 隔离测试通过：生产 resolveRealApiKey 绝不跨平台借用顶层 Key
✓ [4/6] Key 前端状态机测试通过：生产 processKeyForSave 逻辑完全符合状态机规范
✓ [5/6] 尺寸映射测试通过：生产 formatImageResolution 输出完全符合各厂商标准
✓ [6/6] 全量原子写测试通过：生产 writeJson 基于同目录事务重命名运行成功

====================================================
🎉 生产代码真实行为测试 100% 全部通过 (无 mock、全生产函数)！
====================================================

Running isolated E2E HTTP tests...
=== 启动真正端到端本地 HTTP 接口服务测试 (环境隔离版) ===

1. [防跨站测试] 发送缺少 X-Xingse-Client 的跨站 POST 请求...
✓ 成功拦截！返回 403 Forbidden

2. [安全通行测试] 发送携带 X-Xingse-Client: 1 的合法客户端 POST 请求...
✓ 成功通行！返回 200 OK

3. [DELETE 路由稳定性测试] 发送 /api/history DELETE 请求验证是否漏 return...
✓ DELETE 路由正常结束，无 headers-sent 异常崩溃！

4. [OPTIONS 预检测试] 验证 CORS 允许 X-Xingse-Client...
✓ OPTIONS 预检 204 成功，Access-Control-Allow-Headers 声明正常！

🎉 真实 HTTP 服务端到端网络测试 全部 100% 通过！
```
