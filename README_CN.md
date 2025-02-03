# DeepSeek 工程师 🐋

## 概述

本仓库包含一个强大的编码助手应用程序，它与 DeepSeek API 集成，处理用户对话并生成结构化的 JSON 响应。通过直观的命令行界面，它可以读取本地文件内容、创建新文件，并实时应用差异编辑到现有文件中。

## 主要功能

1. DeepSeek 客户端配置
   - 自动配置 API 客户端以使用 DeepSeek 服务，需要有效的 DEEPSEEK_API_KEY。
   - 连接到环境变量中指定的 DeepSeek 端点以流式传输 GPT 类补全。

2. 数据模型
   - 利用 Pydantic 进行类型安全的文件操作处理，包括：
     • FileToCreate – 描述要创建或更新的文件。
     • FileToEdit – 描述现有文件中的特定片段替换。
     • AssistantResponse – 结构化聊天响应和潜在的文件操作。

3. 系统提示
   - 一个全面的系统提示（system_PROMPT）指导对话，确保所有回复严格遵循带有可选文件创建或编辑的 JSON 输出。

4. 辅助函数
   - read_local_file: 读取目标文件系统路径并返回其内容作为字符串。
   - create_file: 使用提供的内容创建或覆盖文件。
   - show_diff_table: 以丰富的多行表格形式呈现提议的文件更改。
   - apply_diff_edit: 对现有文件应用片段级修改。

5. "/add" 命令
   - 用户可以输入 "/add path/to/file" 快速读取文件内容并将其作为系统消息插入对话中。
   - 这允许助手引用文件内容以进行进一步讨论、代码生成或差异提案。

6. 对话流程
   - 维护一个 conversation_history 列表以跟踪用户和助手之间的消息。
   - 通过 DeepSeek API 流式传输助手的回复，将其解析为 JSON 以保留文本响应和文件修改指令。

7. 交互式会话
   - 运行脚本（例如："python3 main.py"）以在终端启动交互式循环。
   - 输入您的请求或代码问题。输入 "/add path/to/file" 将文件内容添加到对话中。
   - 当助手建议新文件或编辑文件时，您可以直接在本地环境中确认更改。
   - 输入 "exit" 或 "quit" 结束会话。

## 开始使用

1. 准备一个包含您的 DeepSeek API 密钥的 .env 文件：
   DEEPSEEK_API_KEY=your_api_key_here

2. 安装依赖并运行：

   ```bash
   npm install
   node main.js
   ```

3. 享受多行流式响应、使用 "/add path/to/file" 读取文件内容，并在批准时进行精确的文件编辑。

> **注意**：这是一个由 Skirano 开发的实验性项目，用于测试新的 DeepSeek v3 API 功能。它是作为快速原型开发的，应相应使用。
