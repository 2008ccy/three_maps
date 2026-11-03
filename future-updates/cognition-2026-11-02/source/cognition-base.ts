import type { MapDefinition } from './types';

// Original IDs, hierarchy, sources and feedback directions are retained.
export const cognitionOriginal: MapDefinition = {
  "id": "cognition",
  "layout": "directed",
  "title": "认知地图",
  "indexId": "C-INDEX",
  "number": "03",
  "question": "探索和判断的方法 · 怎样理解、比较、检验",
  "description": "认知地图＝探索和判断的方法。从三个观选择视角，用分析方法检验案例，再将认识修正反哺成长习惯。",
  "auxiliary": [
    {
      "id": "C-PERSPECTIVES"
    },
    {
      "id": "C-LOSS"
    },
    {
      "id": "C-RANKING"
    },
    {
      "id": "C-COST"
    },
    {
      "id": "C-HABITS"
    },
    {
      "id": "C-REVISION"
    }
  ],
  "connections": [
    {
      "from": "perspectives",
      "to": "analysis-methods",
      "label": "指导选方法"
    },
    {
      "from": "loss-test",
      "to": "revision",
      "label": "跑过后修正"
    },
    {
      "from": "ranking-task",
      "to": "revision",
      "label": "跑过后修正"
    },
    {
      "from": "cost-api",
      "to": "revision",
      "label": "跑过后修正"
    },
    {
      "from": "revision",
      "to": "habits",
      "label": "反哺习惯"
    }
  ],
  "branches": [
    {
      "id": "perspectives",
      "title": "三个观",
      "summary": "看问题的三个侧面",
      "detail": "看问题的三个侧面",
      "documents": [
        {
          "id": "C-PERSPECTIVES"
        }
      ],
      "sources": [
        "L7",
        "L1",
        "L5"
      ],
      "children": [
        {
          "id": "system-view",
          "title": "系统观",
          "summary": "结构 · 瓶颈在哪一环",
          "detail": "回答出错时，先看资料、检索、模型和界面之间的结构与联系，再逐环保存输入输出，定位瓶颈。系统观提供观察整体的视角，具体检查可以用系统拆解与反例检查落实。",
          "documents": [
            {
              "id": "C-PERSPECTIVES",
              "anchor": "three-views"
            }
          ],
          "sources": [
            "L7",
            "L1",
            "L5"
          ],
          "boundary": "素材引用的课堂原件尚待补充。",
          "relations": [
            {
              "map": "domain",
              "node": "rag",
              "label": "用于观察检索与生成"
            }
          ]
        },
        {
          "id": "development-view",
          "title": "发展观",
          "summary": "历史 · 新方法带来新限制",
          "detail": "从全参到 LoRA/QLoRA、从闭卷回答到检索增强，比较新方法缓解的限制、带来的收益与新增边界。沿演进过程理解取舍，不能仅按出现时间判断优劣。",
          "documents": [
            {
              "id": "C-PERSPECTIVES",
              "anchor": "three-views"
            }
          ],
          "sources": [
            "L7",
            "L1",
            "S02",
            "S03",
            "S04"
          ]
        },
        {
          "id": "third-view",
          "title": "求真观",
          "summary": "真伪 · 凭什么信、怎么检验",
          "detail": "新版关系图将第三个视角命名为求真观，关注结论的证据、检验方法与可能反例。执行时打开原文、保留反例，区分事实与推断；遇到新证据时重新判断。",
          "documents": [
            {
              "id": "C-PERSPECTIVES",
              "anchor": "three-views"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "boundary": "这里沿用新版关系图的名称；课堂正式名称与原文页码仍需对照课件核验。"
        }
      ]
    },
    {
      "id": "analysis-methods",
      "title": "分析方法",
      "summary": "六选二到三",
      "detail": "六选二到三",
      "documents": [
        {
          "id": "C-PERSPECTIVES"
        }
      ],
      "sources": [
        "L7",
        "L5"
      ],
      "children": [
        {
          "id": "system-analysis",
          "title": "系统拆解 ＋ 反例检查",
          "summary": "从结构和失败例子检验判断",
          "detail": "从结构和失败例子检验判断",
          "documents": [
            {
              "id": "C-LOSS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "children": [
            {
              "id": "loss-test",
              "title": "案例① 损失下降 ≠ 回答更好",
              "summary": "把训练信号放回真实任务检查",
              "detail": "训练 loss 只反映当前数据与训练目标上的优化情况。先拆解资料、训练、检索和回答环节，再寻找重复、泄漏、过拟合等反例；用同一套独立问题比较正确性、引用、拒答与时延，判断训练信号是否变成实际收益。",
              "documents": [
                {
                  "id": "C-LOSS"
                }
              ],
              "sources": [
                "L7",
                "L5",
                "L6"
              ],
              "boundary": "这是待执行的检验框架，尚无本组完成实验的证据。跑过后记录判断如何改变，再进入认识修正。",
              "relations": [
                {
                  "map": "domain",
                  "node": "loss",
                  "label": "对应损失概念"
                },
                {
                  "map": "domain",
                  "node": "evaluation-set",
                  "label": "使用独立评测集"
                },
                {
                  "map": "domain",
                  "node": "finetuning",
                  "label": "检验微调效果"
                },
                {
                  "map": "cognition",
                  "node": "revision",
                  "label": "跑过后修正"
                }
              ]
            }
          ]
        },
        {
          "id": "comparison",
          "title": "对照比较 ＋ 问题定义",
          "summary": "先定义答疑任务，再比较候选",
          "detail": "先定义答疑任务，再比较候选",
          "documents": [
            {
              "id": "C-RANKING"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "children": [
            {
              "id": "ranking-task",
              "title": "案例② 榜单排名 ≠ 适合答疑",
              "summary": "用课程问题复核通用排名",
              "detail": "先定义课程读者、问题类型和验收标准，再用固定的提示、检索资料与评分规则比较候选模型。通用榜单可以初筛，但解释是否易懂、引用是否支持结论、无答案时能否拒答，需要用真实课程问题重新检查。",
              "documents": [
                {
                  "id": "C-RANKING"
                }
              ],
              "sources": [
                "L7",
                "L5"
              ],
              "boundary": "比较框架仍需补本组实际记录；排名高不自动说明适合当前课程。",
              "relations": [
                {
                  "map": "ecosystem",
                  "node": "benchmarks",
                  "label": "参考通用题库"
                },
                {
                  "map": "domain",
                  "node": "evaluation-set",
                  "label": "使用课程评测集"
                },
                {
                  "map": "cognition",
                  "node": "revision",
                  "label": "跑过后修正"
                }
              ]
            }
          ]
        },
        {
          "id": "tradeoff-method",
          "title": "多目标取舍 ＋ 演进分析",
          "summary": "沿方法演进比较收益与新限制",
          "detail": "沿方法演进比较收益与新限制",
          "documents": [
            {
              "id": "C-COST"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "children": [
            {
              "id": "cost-api",
              "title": "案例③ 效果与成本的取舍",
              "summary": "质量、时延、费用与维护一起比较",
              "detail": "比较 API 加检索、本地模型、自托管 GPU 和 LoRA/QLoRA 等方案，记录任务质量、时延、用量、设备与维护代价。再沿方法演进分析：新方案解决了什么限制，又增加了什么成本，从而说明当前条件下的选择。",
              "documents": [
                {
                  "id": "C-COST"
                }
              ],
              "sources": [
                "L7",
                "L5",
                "S21"
              ],
              "boundary": "当前没有实测账单，不给出确定费用；适配参数更少也不能直接证明端到端总成本最低。",
              "relations": [
                {
                  "map": "ecosystem",
                  "node": "api-platforms",
                  "label": "由 API 平台提供服务"
                },
                {
                  "map": "ecosystem",
                  "node": "inference-cost",
                  "label": "对应推理成本"
                },
                {
                  "map": "domain",
                  "node": "deployment",
                  "label": "对应部署选择"
                },
                {
                  "map": "cognition",
                  "node": "revision",
                  "label": "跑过后修正"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "habits",
      "title": "成长习惯",
      "summary": "六类",
      "detail": "六类",
      "documents": [
        {
          "id": "C-HABITS"
        }
      ],
      "sources": [
        "L7",
        "L5"
      ],
      "children": [
        {
          "id": "define-problem",
          "title": "先定义问题",
          "summary": "选工具前写一张任务卡",
          "detail": "记录读者、困难、输入输出和验收条件。范围变化时保留修改原因，用任务卡检查后续工作是否仍在解决同一个问题。",
          "documents": [
            {
              "id": "C-HABITS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ]
        },
        {
          "id": "check-evidence",
          "title": "找依据和反例",
          "summary": "为判断保留出处与条件",
          "detail": "重要结论打开原文，留下页码、支持条件和可能改变判断的反例。找不到依据时明确标记待核实。",
          "documents": [
            {
              "id": "C-HABITS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ]
        },
        {
          "id": "small-trial",
          "title": "小规模试跑",
          "summary": "先用少量资料跑通一轮",
          "detail": "保存环境、输入输出、成功与失败记录。先确认任务能够端到端运行，再判断需要扩大数据、模型或服务规模。",
          "documents": [
            {
              "id": "C-HABITS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ]
        },
        {
          "id": "learn-from-gaps",
          "title": "从困难反查知识",
          "summary": "知识缺口连接到课程和再尝试",
          "detail": "把讲不清或做不出的点写出来，选择对应教程或课程，学后回到同一个小任务复验，避免只积累学习清单。",
          "documents": [
            {
              "id": "C-HABITS"
            },
            {
              "id": "D-LEARNING"
            }
          ],
          "sources": [
            "L7",
            "L5",
            "L6"
          ]
        },
        {
          "id": "weekly-review",
          "title": "每周分工与检查",
          "summary": "谁修改、谁复核、何时发布",
          "detail": "每周留下简短的修改说明、负责人和复核记录。完成与待办要以产物和检查结果区分，不只写“已经学习”。",
          "documents": [
            {
              "id": "C-HABITS"
            },
            {
              "id": "P-UPDATES"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ]
        },
        {
          "id": "independent-feedback",
          "title": "独立反馈再修订",
          "summary": "让非组员先自行使用",
          "detail": "先观察同学能否独立完成查询，再解释和讨论。保留原始问题、核实过程、处理结果与理由，让反馈成为可追踪的修订。",
          "documents": [
            {
              "id": "C-HABITS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "boundary": "这些是执行规则，尚无记录的项目不能称为已经形成的习惯。认识修正得到的经验还应反过来修改这些规则。",
          "relations": [
            {
              "map": "domain",
              "node": "monitoring",
              "label": "推动系统更新"
            }
          ]
        }
      ]
    },
    {
      "id": "revision",
      "title": "认识修正",
      "summary": "四问",
      "detail": "四问",
      "documents": [
        {
          "id": "C-REVISION"
        }
      ],
      "sources": [
        "L7",
        "L5"
      ],
      "children": [
        {
          "id": "revision-before",
          "title": "原来怎样理解",
          "summary": "先说清旧判断与当时的依据",
          "detail": "素材自述曾把课程中的认知地图理解为空间认知与心理学意义上的 cognitive map，因此搜集了不同方向的材料。技术案例也应先记录原来的判断，而不是事后重写起点。",
          "documents": [
            {
              "id": "C-REVISION"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "boundary": "经历与日期仍需相关成员确认。"
        },
        {
          "id": "revision-evidence",
          "title": "什么带来变化",
          "summary": "指出改变判断的具体证据",
          "detail": "素材案例通过对照作业说明及所指课件第 11、28 页改变理解。技术案例则应保留实际比较、失败样例和新证据，说明它们怎样影响判断。",
          "documents": [
            {
              "id": "C-REVISION"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "boundary": "原课件与查阅记录尚待补充。"
        },
        {
          "id": "revision-after",
          "title": "现在怎样理解",
          "summary": "说明新判断及资料边界的变化",
          "detail": "用损失、榜单和成本等问题组织案例，说明如何提出问题、依据什么判断，以及怎样检验和修正。定义、案例和资料筛选随之调整，并将经验反哺成长习惯。",
          "documents": [
            {
              "id": "C-REVISION"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ],
          "relations": [
            {
              "map": "cognition",
              "node": "habits",
              "label": "反哺习惯"
            }
          ]
        },
        {
          "id": "revision-open",
          "title": "仍不知道什么",
          "summary": "把未确认的地方留在图上",
          "detail": "第三个观的课堂正式名称、课堂原文，以及技术实验能否带来新的认识修正，都需要后续核实或实践。未经确认的自述不能当作已完成的真实经历提交。",
          "documents": [
            {
              "id": "C-REVISION"
            },
            {
              "id": "P-GAPS"
            }
          ],
          "sources": [
            "L7",
            "L5"
          ]
        }
      ]
    }
  ]
};
