# AI Speech Coach — 操作指南

> 平台地址：部署在 Replit 上，访问 Replit 项目的 Webview URL

---

## 目录

- [教师/管理员操作指南](#教师管理员操作指南)
- [学生操作指南](#学生操作指南)
- [完整练习流程演示](#完整练习流程演示)

---

## 教师/管理员操作指南

### 1. 登录

1. 打开平台首页，看到登录卡片
2. 点击上方 **Teacher** 标签页
3. 输入邮箱和密码：
   - 默认管理员账号：`simonwang@hkbu.edu.hk` / `admin123456`
4. 点击 **Sign In as Teacher**
5. 登录成功后自动跳转到 Dashboard

### 2. Dashboard 概览

登录后看到教师 Dashboard，包含以下功能卡片：

| 卡片 | 功能 | 说明 |
|------|------|------|
| **Exercise Management** | 管理练习题 | 创建、编辑、删除练习 |
| **Student Management** | 查看学生 | 查看学生列表和练习记录 |
| **Admin Panel** | 管理员功能 | 注册新教师（仅 Admin 可见） |
| **Try Practice** | 体验练习 | 以教师身份体验学生的练习流程 |

### 3. 创建练习（Exercise Management）

1. 在 Dashboard 点击 **Exercise Management**
2. 点击右上角 **Create Exercise** 按钮
3. 填写练习表单：

| 字段 | 必填 | 说明 |
|------|------|------|
| **Title** | 是 | 练习标题，学生看到的名字 |
| **Description** | 是 | 练习说明，告诉学生要做什么 |
| **Exercise Type** | 是 | 选择练习类型（见下方） |
| **Difficulty** | 是 | Easy / Medium / Hard |
| **Reference Text** | 朗读类必填 | 学生需要朗读的文本 |

4. 点击 **Save** 保存

#### 三种练习类型

**Read Aloud（朗读练习）**
- 学生照着参考文本朗读
- 系统会对比参考文本和学生发音，检测发音偏差
- **必须**填写 Reference Text

**Free Speech（自由演讲）**
- 给学生一个话题，自由发挥
- 不需要 Reference Text
- 系统评估语法、流利度、韵律

**Q&A（问答）**
- 给学生一个问题，学生口头回答
- 可选填参考答案作为 Reference Text

#### 创建练习示例

**示例 A：Easy 朗读练习**
```
Title:        Daily Greeting Practice
Description:  Read the following passage clearly and at a natural pace.
Type:         Read Aloud
Difficulty:   Easy
Reference:    Good morning! My name is David and I am a student at
              Hong Kong Baptist University. I enjoy studying English
              and talking with my friends.
```

**示例 B：Medium 自由演讲**
```
Title:        My Favourite Hobby
Description:  Speak for 1-2 minutes about your favourite hobby.
              Describe what it is, why you enjoy it, and how
              often you do it. Try to speak naturally and clearly.
Type:         Free Speech
Difficulty:   Medium
Reference:    (留空)
```

**示例 C：Hard 问答练习**
```
Title:        Environmental Issues Discussion
Description:  Answer the following question in 1-2 minutes:
              "What do you think is the most serious environmental
              problem today, and what can individuals do to help?"
Type:         Q&A
Difficulty:   Hard
Reference:    (留空或填参考答案)
```

### 4. 编辑/删除练习

- 在 Exercise Management 列表中，每个练习卡片右侧有 **Edit** 和 **Delete** 按钮
- 编辑：修改任意字段后保存
- 删除：需要确认弹窗
- **注意**：教师只能编辑/删除自己创建的练习，Admin 可以操作所有练习

### 5. 学生管理（Student Management）

1. 在 Dashboard 点击 **Student Management**
2. 查看已注册的学生列表
3. 点击学生右侧的 **View Sessions** 查看该学生的练习历史和分数

### 6. 注册新教师（仅 Admin）

1. 在 Student Management 页面，点击右上角 **Register Teacher**
2. 填写：Full Name、Email、Password
3. 点击 **Register**
4. 新教师即可用该邮箱和密码登录

### 7. 切换学生视角预览

- 在页面顶部 Header 中，点击 **Student View** 按钮
- 进入学生视角，可以看到学生看到的 Dashboard 和功能
- 可以体验完整的练习流程
- 点击 **Exit Student View** 返回教师视角

---

## 学生操作指南

### 1. 登录

1. 打开平台首页
2. 在 **Student** 标签页（默认）
3. 输入你的 Student ID（格式：`JS123456`）
   - 首字母缩写 + 学号后4位 + 2位随机数
   - 如果是第一次使用，系统会自动注册
4. 点击 **Sign In as Student**
5. 跳转到 Dashboard

### 2. Dashboard

学生 Dashboard 有三个功能卡片：

| 卡片 | 说明 |
|------|------|
| **Start Practice** | 开始一次新的口语练习 |
| **Practice History** | 查看历史练习记录和分数 |
| **My Progress** | 查看进步趋势 |

### 3. 开始练习

1. 点击 **Start Practice** 进入练习页面
2. 左侧显示所有可用练习列表（教师创建的）
3. 每个练习显示：
   - 标题
   - 难度标签（Easy/Medium/Hard）
   - 类型标签（Read Aloud/Free Speech/Q&A）
   - 创建教师

#### 选择练习

- **选择一个练习**：点击左侧列表中的练习卡片
  - 右侧显示练习详情（标题、描述、参考文本）
  - 点击 **Start Recording** 开始
- **自由练习**：不选择任何练习，直接点击 **Free Practice (No Exercise)** 自由录音

### 4. 录音

1. 点击 Start Recording 后进入 **3 秒倒计时**
2. 倒计时结束后自动开始录音
3. 录音界面显示：
   - 红色录音按钮（方块图标）
   - 实时计时器
   - **Recording** 状态指示
   - 实时音频波形可视化
   - **Stop Recording** 按钮
4. 如果是 Read Aloud 练习，参考文本会显示在上方，跟着读即可
5. 录完后点击红色按钮或底部的 **Stop Recording**

### 5. 等待 AI 分析

停止录音后，系统自动进入分析阶段（约 10-30 秒）：

```
Step 1: Uploading audio...        ✓
Step 2: Transcribing speech...     ✓  (语音转文字)
Step 3: Analyzing voice features... ✓  (韵律分析)
Step 4: Generating feedback...     ✓  (AI 生成反馈)
```

### 6. 查看结果

分析完成后显示三大板块：

#### A. 转写文本（Transcript Display）
- 显示 AI 识别出的你说的内容
- 如果是朗读练习，发音有偏差的词会**高亮标注**
- 标注 "Read Aloud" 或 "Spontaneous" 标签

#### B. 韵律图表（Prosody Chart）
- **Speech Rate**：语速（每分钟多少个词）
  - 正常范围：120-150 wpm
- **Pause Count**：停顿次数
- **Mean Pause Duration**：平均停顿时长
- **F0 Mean / Std**：音高均值和变化幅度
- **Intonation Index**：语调变化指数

#### C. 反馈面板（Feedback Panel）

**环形分数图**展示四项评分：

| 维度 | 权重 | 评估什么 |
|------|------|---------|
| **Grammar** | 30% | 语法准确性 |
| **Fluency** | 25% | 流利度（语速、停顿） |
| **Pronunciation** | 25% | 发音准确度 |
| **Prosody** | 20% | 韵律（语调变化） |

**Overall Score** = Grammar×0.3 + Fluency×0.25 + Pronunciation×0.25 + Prosody×0.2

此外还有：
- **Grammar Errors**：语法错误列表（原句 → 修正 + 解释）
- **Strengths**：你做得好的地方
- **Areas to Improve**：待改进的方面
- **Suggestions**：具体练习建议

### 7. 练习后操作

结果页面底部有两个按钮：
- **Practice Again**：重新练习同一道题
- **Back to Dashboard**：返回首页

### 8. 查看历史记录

1. 在 Dashboard 点击 **Practice History**
2. 看到所有历史练习记录，包含：
   - 日期时间
   - 练习标题
   - 录音时长
   - 总分
3. 点击任意记录查看完整的分析结果

---

## 完整练习流程演示

以下是一个从头到尾的完整操作流程：

### 场景：老师布置朗读练习，学生完成并查看反馈

**教师操作：**

```
1. 登录 → Teacher Tab → simonwang@hkbu.edu.hk / admin123456
2. Dashboard → Exercise Management → Create Exercise
3. 填写：
   Title:       Campus Life Introduction
   Description: Read the following passage about campus life clearly.
                Focus on natural rhythm and clear pronunciation.
   Type:        Read Aloud
   Difficulty:  Easy
   Reference:   Hong Kong Baptist University is located in Kowloon Tong.
                The campus has modern buildings and beautiful gardens.
                Students enjoy a variety of activities including sports,
                music, and academic clubs. The library is open every day
                and provides a quiet space for study and research.
4. 点击 Save
5. (可选) 点 Student View 预览学生会看到什么
```

**学生操作：**

```
1. 登录 → Student Tab → 输入 JS123456
2. Dashboard → Start Practice
3. 左侧列表找到 "Campus Life Introduction" (Easy, Read Aloud)
4. 点击选中 → 右侧显示参考文本
5. 点击 Start Recording → 3 秒倒计时
6. 照着参考文本朗读 → 读完点击 Stop Recording
7. 等待 AI 分析（约 15-30 秒）
8. 查看结果：
   - 转写文本：检查是否有标红的发音偏差
   - 韵律图表：看语速是否在 120-150 wpm 范围内
   - 反馈面板：查看总分和四项评分
   - 阅读 AI 给的建议，了解哪里可以改进
9. 点击 Practice Again 再练一次，对比分数变化
```

**教师查看学生数据：**

```
1. Dashboard → Student Management
2. 找到学生 JS123456 → View Sessions
3. 查看该学生的所有练习记录和分数趋势
```

---

## 评分参考

| 分数段 | 水平 | 建议 |
|--------|------|------|
| 90-100 | Excellent | 保持水平，挑战更高难度 |
| 80-89 | Good | 注意细节，减少小错误 |
| 70-79 | Satisfactory | 有明显改进空间，关注弱项 |
| 60-69 | Needs Improvement | 建议多练习，从 Easy 难度开始 |
| < 60 | Below Average | 需要基础训练，注意发音和语法 |

---

## 常见问题

**Q: 录音时看不到停止按钮？**
A: 向下滚动，或直接点击红色圆形按钮（方块图标）即停止。最新版本已在底部添加明确的 "Stop Recording" 文字按钮。

**Q: 分析时间很长？**
A: 正常需要 10-30 秒，取决于录音长度和服务器负载。如果超过 60 秒，可能是网络问题，刷新重试。

**Q: 提示 "No speech detected"？**
A: 检查麦克风是否正常工作，是否允许了浏览器的麦克风权限，确保录音时说话声音足够大。

**Q: Student ID 格式是什么？**
A: 首字母缩写 + 学号后4位 + 2位随机数，例如 `JS123456`。首次使用会自动注册。
