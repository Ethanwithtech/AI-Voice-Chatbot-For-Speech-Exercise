# AI Speech Coach 项目 MEMORY

## 项目概述
HKBU AI Speech Coach — React + FastAPI 口语练习平台，部署在 Replit (Autoscale 2vCPU/4GiB)

## 技术栈
- 前端: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- 后端: FastAPI + SQLAlchemy + Poe API (GPT-5)
- 数据库: SQLite(本地) / PostgreSQL(Replit)
- 语音: Whisper(本地) / ElevenLabs(STT)

## 关键设计决策
- CRAA练习类型使用独立页面 `/craa-practice`，4阶段流程: Intro→Listen→Prepare→Record→Result
- CRAA评分: Summary Accuracy 40% + Counterargument Quality 30% + Verbal Delivery 30%
- 学生ID格式: `{学号后4位}-{姓名首字母}-{Section}` 如 `6342-YD-A1`
- 教师注册需管理员审批 (is_approved字段)
- 默认管理员: simonwang@hkbu.edu.hk / admin123456

## Replit部署注意
- 已切换到faster-whisper（60MB），不再需要PyTorch（739MB）
- 前端build后需清理node_modules减小包体积
- GitHub token需通过环境变量或git credential管理，不要写入代码文件

## 最近更新 (2026-03-14)
- 实现了新的学生注册流程和教师申请访问功能
- 练习页面录音阶段现在可以查看练习材料
