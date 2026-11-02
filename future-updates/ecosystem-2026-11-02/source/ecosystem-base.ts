import type { MapDefinition } from './types';

// 原有条目及十个分类用于保留分享地址、出处和跨图关系。
export const ecosystemOriginal: MapDefinition = {
  "id": "ecosystem",
  "title": "生态地图",
  "indexId": "E-INDEX",
  "number": "02",
  "question": "依靠谁的成果，又与谁协作？",
  "description": "把研究、开源工具、平台与使用者放回同一张关系网。",
  "auxiliary": [
    {
      "id": "E-PARTICIPANTS"
    },
    {
      "id": "E-RESOURCES"
    },
    {
      "id": "E-PUBLICATIONS"
    },
    {
      "id": "E-COLLABORATION"
    },
    {
      "id": "E-COSTS"
    },
    {
      "id": "E-ACCESS"
    },
    {
      "id": "E-ENTRIES"
    }
  ],
  "branches": [
    {
      "id": "participants",
      "title": "参与者",
      "summary": "谁提出、实现与维护",
      "detail": "谁提出、实现与维护",
      "documents": [
        {
          "id": "E-PARTICIPANTS"
        }
      ],
      "sources": [
        "L4"
      ],
      "children": [
        {
          "id": "research-teams",
          "title": "研究团队",
          "summary": "从原始工作找到方法的来处",
          "detail": "从原始工作找到方法的来处",
          "documents": [
            {
              "id": "E-PARTICIPANTS"
            }
          ],
          "sources": [
            "L4"
          ],
          "children": [
            {
              "id": "attention-authors",
              "title": "Transformer 研究者",
              "summary": "Vaswani 等原始论文作者",
              "detail": "从 Attention Is All You Need 追溯 Transformer 的结构设计与实验背景。这里标识历史论文的作者关系，不把整个研究方向归于单个人。",
              "documents": [
                {
                  "id": "E-ATTN"
                }
              ],
              "sources": [
                "S01"
              ],
              "relations": [
                {
                  "map": "domain",
                  "node": "transformer",
                  "label": "提出 Transformer"
                }
              ]
            },
            {
              "id": "rag-authors",
              "title": "RAG 研究者",
              "summary": "Patrick Lewis 等",
              "detail": "原始 RAG 工作连接检索得到的外部知识与生成模型。本项目借用检索后生成的应用思路，具体系统需要独立设计与评测。",
              "documents": [
                {
                  "id": "E-RAG"
                }
              ],
              "sources": [
                "S02"
              ],
              "boundary": "采用思路不等于复现论文全部训练设计。",
              "relations": [
                {
                  "map": "domain",
                  "node": "rag",
                  "label": "提出 RAG"
                }
              ]
            },
            {
              "id": "lora-authors",
              "title": "LoRA 研究者",
              "summary": "Edward J. Hu 等",
              "detail": "LoRA 提供冻结基座、训练低秩适配器的参数高效适配方法。理解其假设与实验条件后，再判断是否适用于本组任务。",
              "documents": [
                {
                  "id": "E-LORA"
                }
              ],
              "sources": [
                "S03"
              ],
              "relations": [
                {
                  "map": "domain",
                  "node": "lora",
                  "label": "提出 LoRA"
                }
              ]
            },
            {
              "id": "qlora-authors",
              "title": "QLoRA 研究者",
              "summary": "Tim Dettmers、Artidoro Pagnoni 等",
              "detail": "QLoRA 将量化冻结基座与低秩适配结合，讨论更节省显存的适配方法。资源结论要连同模型、设置和设备一起阅读。",
              "documents": [
                {
                  "id": "E-QLORA"
                }
              ],
              "sources": [
                "S04"
              ],
              "boundary": "不能把论文中的显存结果直接当作本组设备保证。"
            },
            {
              "id": "stanford",
              "title": "CS336 课程团队",
              "summary": "从数据到语言模型的学习入口",
              "detail": "Stanford CS336 提供语言模型构建、训练与评测的课程资料，可用于后续系统学习；先按当前问题选取内容，再逐步补齐基础。",
              "documents": [
                {
                  "id": "E-STANFORD"
                },
                {
                  "id": "D-LEARNING"
                }
              ],
              "sources": [
                "S12"
              ],
              "boundary": "课程年度与基础要求应对应具体资料，不作为本次作业的先修门槛。"
            }
          ]
        },
        {
          "id": "model-teams",
          "title": "模型团队",
          "summary": "谁发布可复用的基座",
          "detail": "谁发布可复用的基座",
          "documents": [
            {
              "id": "E-PARTICIPANTS"
            }
          ],
          "sources": [
            "L4"
          ],
          "children": [
            {
              "id": "qwen",
              "title": "Qwen 团队",
              "summary": "模型发布、技术报告与模型卡",
              "detail": "Qwen 的历史发布展示了企业模型如何通过权重、报告和社区工具被复用。选择基座时仍要核对具体型号、revision、许可及适配条件。",
              "documents": [
                {
                  "id": "E-QWEN"
                }
              ],
              "sources": [
                "S11"
              ],
              "boundary": "此处为历史案例，不表示最新型号推荐。",
              "relations": [
                {
                  "map": "domain",
                  "node": "pretraining",
                  "label": "发布预训练基座"
                }
              ]
            }
          ]
        },
        {
          "id": "communities",
          "title": "社区",
          "summary": "谁维护可复用工具",
          "detail": "谁维护可复用工具",
          "documents": [
            {
              "id": "E-PARTICIPANTS"
            }
          ],
          "sources": [
            "L4"
          ],
          "children": [
            {
              "id": "huggingface",
              "title": "Hugging Face 与贡献者",
              "summary": "加载、适配与文档生态",
              "detail": "Transformers、PEFT 和 TRL 等工具把模型加载与训练方法转为可运行的流程。使用时记录版本和配置，并回到原论文理解方法边界。",
              "documents": [
                {
                  "id": "E-HF"
                },
                {
                  "id": "T-PEFT"
                }
              ],
              "sources": [
                "S05",
                "S06",
                "S07"
              ],
              "relations": [
                {
                  "map": "domain",
                  "node": "lora",
                  "label": "通过 PEFT 实现 LoRA"
                }
              ]
            },
            {
              "id": "eleuther",
              "title": "EleutherAI",
              "summary": "可复用的评测工具",
              "detail": "lm-evaluation-harness 提供任务配置和评测运行入口，帮助保存可比较的设置。评测框架不等于题库本身，也不代替本课程任务设计。",
              "documents": [
                {
                  "id": "E-ELEUTHER"
                }
              ],
              "sources": [
                "S09"
              ],
              "relations": [
                {
                  "map": "domain",
                  "node": "evaluation-set",
                  "label": "提供评测实现"
                }
              ]
            }
          ]
        },
        {
          "id": "platform-services",
          "title": "平台服务",
          "summary": "让成果被分发和使用",
          "detail": "让成果被分发和使用",
          "documents": [
            {
              "id": "E-PARTICIPANTS"
            }
          ],
          "sources": [
            "L4"
          ],
          "children": [
            {
              "id": "inference-tools",
              "title": "推理工具",
              "summary": "vLLM / Ollama / llama.cpp",
              "detail": "这些候选工具帮助在不同设备与服务形态下运行模型。比较版本支持、显存、并发、时延和部署复杂度，按本组条件选用。",
              "documents": [
                {
                  "id": "E-DEPLOY"
                }
              ],
              "sources": [
                "S10",
                "L4"
              ],
              "boundary": "候选清单不等于本组已部署或验证。",
              "relations": [
                {
                  "map": "domain",
                  "node": "deployment",
                  "label": "支持推理部署"
                }
              ]
            },
            {
              "id": "distribution",
              "title": "模型分发平台",
              "summary": "ModelScope / Hugging Face",
              "detail": "模型分发连接发布者与使用者，提供权重、模型卡及版本入口。下载之前核对发布者、文件、许可与 revision。",
              "documents": [
                {
                  "id": "E-DISTRIBUTION"
                }
              ],
              "sources": [
                "L4"
              ],
              "boundary": "镜像可用性和下载速度需要在实际网络中验证。"
            },
            {
              "id": "api-platforms",
              "title": "API 平台",
              "summary": "百炼、硅基流动等候选",
              "detail": "托管推理把模型运行交给服务平台，小组负责请求、预算和应用体验。按具体模型及接口测试质量、引用、时延和费用。",
              "documents": [
                {
                  "id": "E-API"
                }
              ],
              "sources": [
                "L4",
                "S21"
              ],
              "boundary": "没有实测账单，不在地图中给出固定价格。",
              "relations": [
                {
                  "map": "domain",
                  "node": "deployment",
                  "label": "提供托管推理"
                },
                {
                  "map": "cognition",
                  "node": "cost-api",
                  "label": "用于方案比较"
                }
              ]
            },
            {
              "id": "application-tools",
              "title": "应用工具",
              "summary": "Dify / Open WebUI 等候选",
              "detail": "应用工具可提供问答界面与流程编排入口。选用前检查检索、引用展示、部署方式和维护成本是否适合课程任务。",
              "documents": [
                {
                  "id": "E-APP"
                }
              ],
              "sources": [
                "L4"
              ],
              "boundary": "接入工具不能代替资料核实和答案质量评测。"
            }
          ]
        }
      ]
    },
    {
      "id": "resources",
      "title": "成果与资源",
      "summary": "哪些成果可以被复用",
      "detail": "哪些成果可以被复用",
      "documents": [
        {
          "id": "E-RESOURCES"
        }
      ],
      "sources": [
        "L4"
      ],
      "children": [
        {
          "id": "attention-paper",
          "title": "Attention 论文",
          "summary": "序列信息怎样交互",
          "detail": "Attention Is All You Need 是理解 Transformer 的原始入口。阅读时连接结构、问题背景、实验设置与局限，而不是只记住名称。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "E-ATTN"
            }
          ],
          "sources": [
            "S01"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "attention",
              "label": "解释注意力机制"
            }
          ]
        },
        {
          "id": "rag-paper",
          "title": "RAG 论文",
          "summary": "外部知识怎样参与生成",
          "detail": "RAG 原始研究把外部检索记忆与生成模型结合。课程助手关注检索命中、依据使用和引用正确性，需要以本组数据验证。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "E-RAG"
            }
          ],
          "sources": [
            "S02"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "rag",
              "label": "提供方法依据"
            }
          ]
        },
        {
          "id": "lora-paper",
          "title": "LoRA / QLoRA 论文",
          "summary": "适配参数与显存怎样减少",
          "detail": "两篇工作分别讨论低秩适配和量化基座上的适配。将训练参数、量化条件和资源预算分开比较，避免把方法名称当作效果保证。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "E-LORA"
            },
            {
              "id": "E-QLORA"
            }
          ],
          "sources": [
            "S03",
            "S04"
          ]
        },
        {
          "id": "model-releases",
          "title": "模型与技术报告",
          "summary": "把发布信息接到可复现版本",
          "detail": "模型卡、技术报告和具体权重版本共同界定可复用的对象。Qwen 的历史发布是本地图的示例，最终实验还要记录实际 revision。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "E-QWEN"
            }
          ],
          "sources": [
            "S11"
          ]
        },
        {
          "id": "course-data",
          "title": "授权课程资料",
          "summary": "最贴近课程的问答依据",
          "detail": "课程原文、自建问答与评分要点连接真实学习困难和模型评测。小组需要建设独立测试并保留出处，不能把收集材料等同于已完成评测。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "D-EVALUATION"
            }
          ],
          "sources": [
            "L3",
            "L4"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "collection",
              "label": "作为数据采集对象"
            }
          ]
        },
        {
          "id": "benchmarks",
          "title": "C-Eval / MMLU",
          "summary": "通用能力的初筛入口",
          "detail": "通用题库可帮助初筛候选模型，但课程中的解释、引用和拒答是另外的检查对象。榜单结果必须结合评测条件阅读。",
          "documents": [
            {
              "id": "E-RESOURCES"
            }
          ],
          "sources": [
            "L4"
          ],
          "relations": [
            {
              "map": "cognition",
              "node": "ranking-task",
              "label": "需以课程任务复核"
            }
          ]
        },
        {
          "id": "evaluation-tools",
          "title": "评测框架",
          "summary": "lm-evaluation-harness / OpenCompass",
          "detail": "框架帮助规范任务配置和运行过程。先核对具体任务支持与版本，再用固定设置记录结果和失败案例。",
          "documents": [
            {
              "id": "E-RESOURCES"
            },
            {
              "id": "E-ELEUTHER"
            }
          ],
          "sources": [
            "S09",
            "L4"
          ],
          "boundary": "框架与题库是不同对象。",
          "relations": [
            {
              "map": "domain",
              "node": "evaluation-set",
              "label": "用于运行评测"
            }
          ]
        }
      ]
    },
    {
      "id": "publications",
      "title": "会议与信息入口",
      "summary": "在哪里追溯和跟进",
      "detail": "在哪里追溯和跟进",
      "documents": [
        {
          "id": "E-PUBLICATIONS"
        }
      ],
      "sources": [
        "S14",
        "L4"
      ],
      "children": [
        {
          "id": "ml-conferences",
          "title": "NeurIPS / ICML / ICLR",
          "summary": "模型、优化与表征学习",
          "detail": "从与选题直接相关的正式论文出发，追踪方法和实验条件。会议声誉只能帮助筛选入口，不能代替对单篇论文证据的判断。",
          "documents": [
            {
              "id": "E-PUBLICATIONS"
            }
          ],
          "sources": [
            "S14",
            "L4"
          ],
          "boundary": "正文保留 CCF 2022 版口径与待核实标签，不称为最新目录。"
        },
        {
          "id": "ai-language-conferences",
          "title": "ACL / AAAI",
          "summary": "语言任务与人工智能应用",
          "detail": "围绕语言模型、评测和综合应用寻找工作。核对具体论文类别与正式发表信息，避免把预印本与已发表论文混用。",
          "documents": [
            {
              "id": "E-PUBLICATIONS"
            }
          ],
          "sources": [
            "S14",
            "L4"
          ]
        },
        {
          "id": "journals",
          "title": "JMLR / TACL",
          "summary": "从期刊追问题与方法",
          "detail": "JMLR 连接机器学习及部分软件工作，TACL 关注计算语言学与自然语言处理。阅读时优先检查任务相关性和实验依据。",
          "documents": [
            {
              "id": "E-PUBLICATIONS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "official-information",
          "title": "论文 / 模型卡 / 文档",
          "summary": "按用途选择第一手依据",
          "detail": "论文解释方法，模型卡说明对象与许可，项目文档解释支持范围。遇到版本变化时，从 Releases 和 Changelog 追踪，再按实际配置复核。",
          "documents": [
            {
              "id": "E-PUBLICATIONS"
            },
            {
              "id": "P-SOURCES"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "community-information",
          "title": "Issue / 博客",
          "summary": "发现问题后回到证据",
          "detail": "社区讨论可提供故障线索和经验，但需要回到代码、文档或可重复实验核实。固定跟进少量项目，比泛泛追踪整个领域更可持续。",
          "documents": [
            {
              "id": "E-PUBLICATIONS"
            }
          ],
          "sources": [
            "L4"
          ]
        }
      ]
    },
    {
      "id": "collaboration",
      "title": "协作链路",
      "summary": "成果怎样走到使用者",
      "detail": "成果怎样走到使用者",
      "documents": [
        {
          "id": "E-COLLABORATION"
        }
      ],
      "sources": [
        "L4"
      ],
      "children": [
        {
          "id": "publish-weights",
          "title": "发布权重与模型卡",
          "summary": "发布者说明对象和边界",
          "detail": "模型机构发布权重、技术信息与许可，使用者据此判断是否可以下载、适配与部署。明确对象版本是协作链的起点。",
          "documents": [
            {
              "id": "E-COLLABORATION"
            }
          ],
          "sources": [
            "L4",
            "S11"
          ]
        },
        {
          "id": "distribute-weights",
          "title": "分发与下载",
          "summary": "平台连接发布者和开发者",
          "detail": "分发渠道影响模型的可获得性。核对来源和版本之后，再记录下载、许可及环境约束，使后续实验可以追溯。",
          "documents": [
            {
              "id": "E-COLLABORATION"
            },
            {
              "id": "E-DISTRIBUTION"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "load-adapt",
          "title": "加载与适配",
          "summary": "开源工具把方法变成流程",
          "detail": "开发者通过模型加载、数据处理和适配工具连接研究方法与实际任务；工具版本、训练设置与数据切分共同影响结果。",
          "documents": [
            {
              "id": "E-COLLABORATION"
            },
            {
              "id": "E-HF"
            }
          ],
          "sources": [
            "S05",
            "S07",
            "L4"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "finetuning",
              "label": "实现适配流程"
            }
          ]
        },
        {
          "id": "serve-model",
          "title": "推理服务",
          "summary": "本地推理或托管 API",
          "detail": "推理层把模型能力暴露为服务，应用层需要处理预算、异常和响应时间。模型可运行只是可用系统的一环。",
          "documents": [
            {
              "id": "E-COLLABORATION"
            },
            {
              "id": "E-API"
            }
          ],
          "sources": [
            "L4"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "deployment",
              "label": "实现服务接口"
            }
          ]
        },
        {
          "id": "user-feedback",
          "title": "助手与用户反馈",
          "summary": "从使用结果回到资料与评测",
          "detail": "应用将检索、回答与引用交给同学使用。收集真实问题，核实反馈，再修订材料、提示或服务设置，形成可追踪的更新。",
          "documents": [
            {
              "id": "E-COLLABORATION"
            }
          ],
          "sources": [
            "L4"
          ],
          "relations": [
            {
              "map": "domain",
              "node": "monitoring",
              "label": "反馈用于监控与修订"
            }
          ]
        }
      ]
    },
    {
      "id": "costs",
      "title": "资源与成本",
      "summary": "谁投入、谁使用、谁承担",
      "detail": "谁投入、谁使用、谁承担",
      "documents": [
        {
          "id": "E-COSTS"
        }
      ],
      "sources": [
        "L4"
      ],
      "children": [
        {
          "id": "training-cost",
          "title": "预训练与发布",
          "summary": "机构投入数据与算力",
          "detail": "复用基座将已有训练成果带进课程项目，但不代表原始训练没有成本。缺少公开账单时，不推算单次训练的确定费用。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "distribution-cost",
          "title": "权重分发",
          "summary": "发布者、平台与镜像维护者",
          "detail": "带宽、存储和维护让权重能被下载。免费访问是使用条件，不是平台无成本或未来永久免费的证明。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "maintenance-cost",
          "title": "工具维护",
          "summary": "社区、公司与研究者",
          "detail": "适配、文档和问题修复需要持续投入。选工具时检查任务适配与维护情况，不只比较热度。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "inference-cost",
          "title": "推理成本",
          "summary": "调用方或自托管者付出资源",
          "detail": "API 费用、设备占用和运维时间都需要进入预算。用相同问题记录质量、时延与用量，再比较方案。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4",
            "S21"
          ],
          "relations": [
            {
              "map": "cognition",
              "node": "cost-api",
              "label": "用于成本取舍"
            }
          ]
        },
        {
          "id": "content-cost",
          "title": "内容与应用维护",
          "summary": "资料权利人、组员与运营者",
          "detail": "整理、核实、托管和修订是小组的持续工作。调用模型 API 无法替代内容责任，也不能替代独立用户反馈。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "visitor-role",
          "title": "访客使用与反馈",
          "summary": "同学带来真实问题",
          "detail": "课程项目计划让同学免费使用，由小组或课程资源承担服务费用。使用反馈是改进线索，不默认访客愿意提供个人资料或密钥。",
          "documents": [
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ],
          "boundary": "这是项目方案，不是已经验证的商业模式。"
        }
      ]
    },
    {
      "id": "access",
      "title": "网络与访问",
      "summary": "可获得性也有条件",
      "detail": "可获得性也有条件",
      "documents": [
        {
          "id": "E-ACCESS"
        }
      ],
      "sources": [
        "L4"
      ],
      "children": [
        {
          "id": "access-observation",
          "title": "一次访问观察",
          "summary": "时间、网络与入口一起记录",
          "detail": "素材包含 2026-10-25 的个人访问观察。它只能说明当次条件下的结果，不代表所有地区、所有时间都可访问或不可访问。",
          "documents": [
            {
              "id": "E-ACCESS"
            }
          ],
          "sources": [
            "L4"
          ],
          "boundary": "当前尚未重新实测，不将旧观察显示为实时状态。"
        },
        {
          "id": "access-validation",
          "title": "实际环境复核",
          "summary": "在最终使用网络上验证",
          "detail": "部署前分别检查站点、模型下载与 API，并记录时间、网络、版本和错误信息。一次超时不应被扩展为地区性结论。",
          "documents": [
            {
              "id": "E-ACCESS"
            }
          ],
          "sources": [
            "L4"
          ]
        },
        {
          "id": "access-boundaries",
          "title": "许可与服务边界",
          "summary": "可下载、可用与可再分发不同",
          "detail": "模型许可、服务地域和分发渠道共同影响方案可行性。先确认实际任务允许的使用方式，再把验证结果写入项目记录。",
          "documents": [
            {
              "id": "E-ACCESS"
            },
            {
              "id": "E-COSTS"
            }
          ],
          "sources": [
            "L4"
          ]
        }
      ]
    }
  ]
};
