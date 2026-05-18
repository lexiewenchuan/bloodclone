# 血染钟楼 JSON 结构分析

## 结构体类型

### 1. 元数据结构体（Meta）

**识别特征**：`id: "_meta"`

**核心字段**：
- `id`: 固定为 "_meta"
- `logo`: 剧本Logo图片URL
- `name`: 剧本名称
- `townsfolkName`: 镇民的中文名称
- `author`: 剧本作者

**示例**：
```json
{
  "id": "_meta",
  "logo": "https://oss.gstonegames.com/data_file/clocktower/upload/1689598760_197011_8687.png",
  "name": "横行霸道v4.7",
  "townsfolkName": "镇民",
  "author": "Manny"
}
```

### 2. 普通角色结构体（Role）

**识别特征**：team为
- 镇民: `team: "townsfolk"`
- 外来者: `team: "outsider"`
- 爪牙: `team: "minion"`
- 恶魔: `team: "demon"`

**核心字段**：
- `id`: 角色唯一标识符
- `name`: 角色名称
- `team`: 角色阵营
- `ability`: 角色能力描述
- `image`: 角色图片URL
- `firstNight`: 首个夜晚的行动顺序
- `otherNight`: 其他夜晚的行动顺序
- `setup`: 是否在设置阶段需要特殊处理
- `reminders`: 角色提醒标记
- `remindersGlobal`: 全局提醒标记
- `firstNightReminder`: 首个夜晚的提醒文本
- `otherNightReminder`: 其他夜晚的提醒文本

**阵营细分**：
- 镇民: `team: "townsfolk"`
- 外来者: `team: "outsider"`
- 爪牙: `team: "minion"`
- 恶魔: `team: "demon"`

**示例**：
```json
{
  "firstNightReminder": "展示给炼金术士一个不在场的角色标记。",
  "otherNightReminder": "",
  "name": "炼金术士",
  "otherNight": 0,
  "setup": false,
  "reminders": [],
  "id": "alchemistbutton",
  "edition": "custom",
  "remindersGlobal": ["是炼金术士"],
  "team": "townsfolk",
  "name_eng": "Alchemist",
  "firstNight": 3,
  "ability": "你拥有一个爪牙角色的能力。当你使用能力时，说书人可能会要求你更换选择。",
  "image": "https://oss.gstonegames.com/data_file/clocktower/web/icons/alchemist.png"
}
```

### 3. 传奇角色结构体（Fabled）

**识别特征**：`team: "fabled"`

**核心字段**：与普通角色结构体类似，但 `team` 字段为 "fabled"

**示例**：
```json
{
  "ability": "使用灯神的相克规则。所有玩家都会知道其内容。",
  "image": "https://oss.gstonegames.com/data_file/clocktower/role_icon/djinn.png",
  "edition": "custom",
  "flavor": "flavor",
  "id": "djinnbutton",
  "firstNightReminder": "firstNightReminder",
  "otherNightReminder": "otherNightReminder",
  "name": "灯神",
  "otherNight": 0,
  "setup": 0,
  "reminders": [],
  "remindersGlobal": [],
  "team": "fabled",
  "firstNight": 0
}
```

### 4. 相克角色结构体（Jinxed）

**识别特征**：`team: "a jinxed"`

**核心字段**：
- `id`: 诅咒唯一标识符
- `name`: 诅咒名称
- `team`: 固定为 "a jinxed"
- `ability`: 诅咒效果描述

**示例**：
```json
{
  "id": "56786542_meta",
  "image": "https://clocktower-wiki.gstonegames.com/images/thumb/e/ed/Cannibal.png/300px-Cannibal.png",
  "name": "食人族&罂粟种植者",
  "team": "a jinxed",
  "setup": 0,
  "ability": "如果食人族获得了罂粟种植者的能力，当他获得下一个能力时，爪牙和恶魔也会互相认识。"
}
```

## 字段说明

### 通用字段
- **id**: 唯一标识符，通常以 "button" 结尾或使用自定义格式
- **name**: 角色/剧本/诅咒的名称
- **team**: 阵营/类型标识
- **ability**: 能力/效果描述
- **image**: 图片URL
- **edition**: 版本，通常为 "custom"

### 角色特有字段
- **firstNight**: 首个夜晚的行动顺序，数值越小行动越早
- **otherNight**: 其他夜晚的行动顺序
- **setup**: 是否在设置阶段需要特殊处理
- **reminders**: 角色提醒标记列表
- **remindersGlobal**: 全局提醒标记列表
- **firstNightReminder**: 首个夜晚的提醒文本
- **otherNightReminder**: 其他夜晚的提醒文本
- **name_eng**: 角色英文名称

## 解析建议

1. **按类型分组**：解析时可根据 `team` 字段将角色分为不同组
2. **元数据处理**：优先处理 `id: "_meta"` 的条目，获取剧本基本信息
3. **传奇角色处理**：单独处理 `team: "fabled"` 的条目
4. **相克处理**：单独处理 `team: "a jinxed"` 的条目
5. **行动顺序**：根据 `firstNight` 和 `otherNight` 字段排序角色行动顺序

## 注意事项

- 不同角色的字段可能有所不同，解析时应考虑字段缺失的情况
- 部分角色可能没有 `firstNight` 或 `otherNight` 字段
- 部分角色可能没有 `image` 字段
- 诅咒角色的结构与普通角色有所不同

## 后续优化

- [ ] 完善字段说明
- [ ] 添加更多示例
- [ ] 提供解析代码示例
- [ ] 补充其他可能的结构体类型
