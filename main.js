import { OpenAI } from 'openai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';
import { createInterface } from 'readline';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  unlinkSync,
  existsSync,
} from 'fs';
import chalk from 'chalk';
import { table } from 'table';
import boxen from 'boxen';

// 初始化环境变量
config();

// 配置OpenAI客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// 初始化控制台界面
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 定义系统提示词
const systemPrompt = `
You are an elite software engineer called DeepSeek Engineer with decades of experience across all programming domains.
Your expertise spans system design, algorithms, testing, and best practices.
You provide thoughtful, well-structured solutions while explaining your reasoning.

Core capabilities:
1. Code Analysis & Discussion
   - Analyze code with expert-level insight
   - Explain complex concepts clearly
   - Suggest optimizations and best practices
   - Debug issues with precision

2. File Operations:
   a) Read existing files
      - Access user-provided file contents for context
      - Analyze multiple files to understand project structure

   b) Create new files
      - Generate complete new files with proper structure
      - Create complementary files (tests, configs, etc.)

   c) Edit existing files
      - Make precise changes using diff-based editing
      - Modify specific sections while preserving context
      - Suggest refactoring improvements

Output Format:
You must provide responses in this JSON structure:
{
  "assistant_reply": "Your main explanation or response",
  "files_to_create": [
    {
      "path": "path/to/new/file",
      "content": "complete file content"
    }
  ],
  "files_to_edit": [
    {
      "path": "path/to/existing/file",
      "original_snippet": "exact code to be replaced",
      "new_snippet": "new code to insert"
    }
  ]
}

Guidelines:
1. For normal responses, use 'assistant_reply'
2. When creating files, include full content in 'files_to_create'
3. For editing files:
   - Use 'files_to_edit' for precise changes
   - Include enough context in original_snippet to locate the change
   - Ensure new_snippet maintains proper indentation
   - Prefer targeted edits over full file replacements
4. Always explain your changes and reasoning
5. Consider edge cases and potential impacts
6. Follow language-specific best practices
7. Suggest tests or validation steps when appropriate

Remember: You're a senior engineer - be thorough, precise, and thoughtful in your solutions.
`;

// 对话历史记录
const conversationHistory = [{ role: 'system', content: systemPrompt }];

// 辅助函数
function readLocalFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

function createFile(path, content) {
  try {
    const dirPath = dirname(path);
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(path, content);
    console.log(
      chalk.green('✓'),
      `Created/updated file at '${chalk.cyan(path)}'`
    );

    // 记录操作
    conversationHistory.push({
      role: 'assistant',
      content: `✓ Created/updated file at '${path}'`,
    });

    // 添加文件内容到对话上下文
    const normalizedPath = normalizePath(path);
    conversationHistory.push({
      role: 'system',
      content: `Content of file '${normalizedPath}':\n\n${content}`,
    });
  } catch (error) {
    console.error(chalk.red('✗'), `Error creating file: ${error.message}`);
  }
}

function showDiffTable(filesToEdit) {
  if (!filesToEdit?.length) return;

  const data = [['File Path', 'Original', 'New']];

  filesToEdit.forEach((edit) => {
    data.push([edit.path, edit.original_snippet, edit.new_snippet]);
  });

  console.log(
    boxen(table(data), {
      title: 'Proposed Edits',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'magenta',
    })
  );
}

function applyDiffEdit(path, originalSnippet, newSnippet) {
  try {
    const backupPath = `${path}.bak`;
    if (existsSync(path)) {
      copyFileSync(path, backupPath);
    }

    const content = readLocalFile(path);
    if (content.includes(originalSnippet)) {
      const updatedContent = content.replace(originalSnippet, newSnippet);
      createFile(path, updatedContent);
      console.log(
        chalk.green('✓'),
        `Applied diff edit to '${chalk.cyan(path)}'`
      );
      conversationHistory.push({
        role: 'assistant',
        content: `✓ Applied diff edit to '${path}'`,
      });

      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }
    } else {
      console.log(
        chalk.yellow('⚠'),
        `Original snippet not found in '${chalk.cyan(path)}'. No changes made.`
      );
      console.log('\nExpected snippet:');
      console.log(
        boxen(originalSnippet, { title: 'Expected', borderColor: 'yellow' })
      );
      console.log('\nActual file content:');
      console.log(boxen(content, { title: 'Actual', borderColor: 'yellow' }));
    }
  } catch (error) {
    console.error(chalk.red('✗'), `Error applying diff edit: ${error.message}`);
  }
}

function tryHandleAddCommand(userInput) {
  const prefix = '/add ';
  if (userInput.trim().toLowerCase().startsWith(prefix)) {
    const filePath = userInput.slice(prefix.length).trim();
    try {
      const content = readLocalFile(filePath);
      conversationHistory.push({
        role: 'system',
        content: `Content of file '${filePath}':\n\n${content}`,
      });
      console.log(
        chalk.green('✓'),
        `Added file '${chalk.cyan(filePath)}' to conversation.\n`
      );
      return true;
    } catch (error) {
      console.error(
        chalk.red('✗'),
        `Could not add file '${chalk.cyan(filePath)}': ${error.message}\n`
      );
      return true;
    }
  }
  return false;
}

function ensureFileInContext(filePath) {
  try {
    const normalizedPath = normalizePath(filePath);
    const content = readLocalFile(normalizedPath);
    const fileMarker = `Content of file '${normalizedPath}'`;
    if (!conversationHistory.some((msg) => msg.content.includes(fileMarker))) {
      conversationHistory.push({
        role: 'system',
        content: `${fileMarker}:\n\n${content}`,
      });
    }
    return true;
  } catch (error) {
    console.error(
      chalk.red('✗'),
      `Could not read file '${chalk.cyan(filePath)}' for editing context`
    );
    return false;
  }
}

function normalizePath(pathStr) {
  try {
    if (!pathStr?.trim()) {
      throw new Error('Empty path provided');
    }
    return isAbsolute(pathStr)
      ? resolve(pathStr)
      : resolve(process.cwd(), pathStr);
  } catch (error) {
    throw new Error(`Invalid path '${pathStr}': ${error.message}`);
  }
}

function guessFilesInMessage(userMessage) {
  const recognizedExtensions = [
    '.css',
    '.html',
    '.js',
    '.py',
    '.json',
    '.md',
    '.txt',
    '.yaml',
    '.yml',
    '.xml',
  ];
  const potentialPaths = [];

  userMessage.split(' ').forEach((word) => {
    if (
      recognizedExtensions.some((ext) => word.includes(ext)) ||
      word.includes('/')
    ) {
      const path = word.replace(/['",]/g, '');
      try {
        const normalizedPath = normalizePath(path);
        potentialPaths.push(normalizedPath);
      } catch (error) {
        // Skip invalid paths
      }
    }
  });

  return potentialPaths;
}

async function streamOpenAIResponse(userMessage) {
  const potentialPaths = guessFilesInMessage(userMessage);
  const validFiles = {};

  // 尝试读取所有可能的文件
  for (const path of potentialPaths) {
    try {
      const content = readLocalFile(path);
      validFiles[path] = content;
      const fileMarker = `Content of file '${path}'`;
      if (
        !conversationHistory.some((msg) => msg.content.includes(fileMarker))
      ) {
        conversationHistory.push({
          role: 'system',
          content: `${fileMarker}:\n\n${content}`,
        });
      }
    } catch (error) {
      console.error(
        chalk.red('✗'),
        `Cannot proceed: File '${path}' does not exist or is not accessible`
      );
      continue;
    }
  }

  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    console.log('conversationHistory', conversationHistory);
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: conversationHistory,
      response_format: { type: 'json_object' },
      max_tokens: 8000,
      stream: true,
    });

    process.stdout.write(chalk.bold.blue('\nAssistant> '));
    let fullContent = '';

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        const contentChunk = chunk.choices[0].delta.content;
        fullContent += contentChunk;
        process.stdout.write(contentChunk);
      }
    }

    console.log();

    try {
      console.log('fullContent', fullContent);
      const parsedResponse = JSON.parse(fullContent);

      // 确保assistant_reply存在
      if (!parsedResponse.assistant_reply) {
        parsedResponse.assistant_reply = '';
      }

      // 处理文件编辑
      if (parsedResponse.files_to_edit?.length) {
        const newFilesToEdit = [];
        for (const edit of parsedResponse.files_to_edit) {
          try {
            const editAbsPath = normalizePath(edit.path);
            if (validFiles[editAbsPath] || ensureFileInContext(editAbsPath)) {
              edit.path = editAbsPath;
              newFilesToEdit.push(edit);
            }
          } catch (error) {
            console.log(
              chalk.yellow('⚠'),
              `Skipping invalid path: '${edit.path}'`
            );
            continue;
          }
        }
        parsedResponse.files_to_edit = newFilesToEdit;
      }

      // 保存助手回复到对话历史
      conversationHistory.push({
        role: 'assistant',
        content: parsedResponse.assistant_reply,
      });

      return parsedResponse;
    } catch (error) {
      const errorMsg = 'Failed to parse JSON response from assistant';
      console.error(chalk.red('✗'), errorMsg);
      return {
        assistant_reply: errorMsg,
        files_to_create: [],
      };
    }
  } catch (error) {
    const errorMsg = `DeepSeek API error: ${error.message}`;
    console.error(chalk.red('\n✗'), errorMsg);
    return {
      assistant_reply: errorMsg,
      files_to_create: [],
    };
  }
}

// 主程序
async function main() {
  console.log(
    boxen(
      chalk.bold.blue('Welcome to Deep Seek Engineer with Structured Output') +
        chalk.green(' (and streaming)') +
        '🐋',
      { borderStyle: 'round', borderColor: 'blue', padding: 1 }
    )
  );

  console.log(
    `To include a file in the conversation, use '${chalk.magenta(
      '/add path/to/file'
    )}'.\n` + `Type '${chalk.red('exit')}' or '${chalk.red('quit')}' to end.\n`
  );

  while (true) {
    try {
      const userInput = await new Promise((resolve) => {
        rl.question(chalk.bold.green('You> '), resolve);
      }).then((input) => input.trim());

      if (!userInput) continue;

      if (['exit', 'quit'].includes(userInput.toLowerCase())) {
        console.log(chalk.yellow('Goodbye!'));
        break;
      }

      if (tryHandleAddCommand(userInput)) continue;

      const responseData = await streamOpenAIResponse(userInput);

      if (responseData.files_to_create?.length) {
        for (const fileInfo of responseData.files_to_create) {
          createFile(fileInfo.path, fileInfo.content);
        }
      }

      if (responseData.files_to_edit?.length) {
        showDiffTable(responseData.files_to_edit);
        const confirm = await new Promise((resolve) => {
          rl.question(
            `\nDo you want to apply these changes? (${chalk.green(
              'y'
            )}/${chalk.red('n')}): `,
            resolve
          );
        }).then((input) => input.trim().toLowerCase());

        if (confirm === 'y') {
          for (const editInfo of responseData.files_to_edit) {
            applyDiffEdit(
              editInfo.path,
              editInfo.original_snippet,
              editInfo.new_snippet
            );
          }
        } else {
          console.log(chalk.yellow('ℹ'), 'Skipped applying diff edits.');
        }
      }
    } catch (e) {
      console.log('e', e);
    }
  }

  console.log(chalk.blue('Session finished.'));
  rl.close();
}

// 启动程序
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
