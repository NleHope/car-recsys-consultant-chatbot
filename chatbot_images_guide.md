# Hướng dẫn tạo hình ảnh cho ChatBot.tex

## Hình đã có, dùng được

| File | Vị trí | Ghi chú |
|------|--------|---------|
| `RAG_graph.png` | `images/RAG_graph.png` | Đã dùng ở §Mô hình cơ sở, caption đã được sửa thành "mô hình RAG tổng quát làm nền tảng lý thuyết" |
| `rag_model.png` | `images/rag_model.png` | Chưa dùng — có thể bổ sung nếu muốn thêm hình về memory builder |

---

## 4 Hình nên tạo mới

### Hình 1: `chatbot_langgraph.png` — LangGraph Agentic Graph
**Nguồn:** Diagram #5 trong [`docs/architecture/diagrams.md`](file:///c:/Users/Lenovo/Videos/car-recsys-consultant-chatbot/docs/architecture/diagrams.md) (dòng 177–207)

**Cách export:**
1. Copy đoạn Mermaid (dòng 178–207) từ `diagrams.md`
2. Dán vào [mermaid.live](https://mermaid.live)
3. Export PNG → lưu vào `images/chatbot_langgraph.png`

**Vị trí thêm vào ChatBot.tex:** Cuối §Kiến trúc Agentic (sau đoạn giới thiệu StateGraph, trước §Hồ sơ người dùng)

```latex
\begin{figure}[!htbp]
    \centering
    \includegraphics[width=1\linewidth]{chatbot_langgraph.png}
    \caption{Kiến trúc Agentic LangGraph của chatbot tư vấn xe (chatbot v2)}
    \label{fig:chatbot-langgraph}
\end{figure}
\FloatBarrier
```

---

### Hình 2: `chatbot_intent_routing.png` — Intent Routing Flow

**Nội dung cần vẽ:** Flow diagram thể hiện 7 intent và nhánh xử lý. Copy Mermaid sau và render tại mermaid.live:

```mermaid
%%{init: {'flowchart': {'curve': 'stepAfter'}}}%%
flowchart TB
  q["Câu hỏi người dùng"]:::host
  up["update_profile\n(slot-fill UserProfile)"]:::rank
  ri{{"route_intent\n(IntentDecision LLM)"}}:::orch

  q --> up --> ri

  compare["compare_retrieve\n→ compare_answer\n(so sánh 2+ xe)"]:::recall
  analytics["analytics_retrieve\n→ analytics_answer\n(thống kê nền tảng)"]:::gold
  spec["spec_retrieve\n→ spec_answer\n(thông số 1 xe)"]:::recall
  hybrid["hybrid_retrieve\n→ consult\n(SQL + Qdrant)"]:::vec
  askslot["ask_slot\n(thiếu core slots)"]:::rank
  redirect["redirect_topic\n(off_topic)"]:::note

  ri -->|compare| compare
  ri -->|analytics| analytics
  ri -->|specs| spec
  ri -->|"specific / vague\n(core complete)"| hybrid
  ri -->|"vague (core missing)"| askslot
  ri -->|off_topic| redirect

  ans["gpt-4o-mini\ngrounded answer"]:::orch
  compare & analytics & spec & hybrid & askslot & redirect --> ans

  classDef host fill:#a5d8ff,stroke:#4a9eed,color:#000
  classDef rank fill:#fff3bf,stroke:#f59e0b,color:#000
  classDef gold fill:#b2f2bb,stroke:#22c55e,color:#000
  classDef vec fill:#eebefa,stroke:#ec4899,color:#000
  classDef orch fill:#d0bfff,stroke:#8b5cf6,color:#000
  classDef recall fill:#d0bfff,stroke:#8b5cf6,color:#000
  classDef note fill:#f8f9fa,stroke:#adb5bd,color:#000
```

**Lưu vào:** `images/chatbot_intent_routing.png`

**Vị trí thêm vào ChatBot.tex:** Cuối §Phân loại ý định (sau bảng 7 intent)

```latex
\begin{figure}[!htbp]
    \centering
    \includegraphics[width=1\linewidth]{chatbot_intent_routing.png}
    \caption{Luồng định tuyến ý định trong LangGraph (7 intent → nhánh chuyên biệt)}
    \label{fig:chatbot-intent-routing}
\end{figure}
\FloatBarrier
```

---

### Hình 3: `chatbot_hybrid_retrieval.png` — Hybrid Retrieval Flow

**Nội dung cần vẽ:** Hybrid SQL + Qdrant retrieval và context assembly:

```mermaid
%%{init: {'flowchart': {'curve': 'stepAfter'}}}%%
flowchart LR
  q["Standalone Question\n(normalized)"]:::host

  subgraph RETRIEVE["Hybrid Retrieval"]
    sql["SQL Hard-Filter\ngold.vehicles\n(brand/price/fuel/status)"]:::gold
    qdrant["Qdrant Semantic\ncar_vectorize\n(score ≤ 1.3, top-5)"]:::vec
  end

  enrich["Enrich Context\ngold.vehicle_images\ngold.vehicle_features"]:::store

  merge["Context Assembly\n[SQL Matches]\n+\n[Semantic Matches]"]:::rank

  gen["gpt-4o-mini\n+ Customer Profile\n+ Chat History"]:::orch
  ans["Answer + Vehicle Cards"]:::out

  q --> sql & qdrant
  sql --> enrich
  qdrant --> enrich
  enrich --> merge --> gen --> ans

  classDef host fill:#a5d8ff,stroke:#4a9eed,color:#000
  classDef gold fill:#b2f2bb,stroke:#22c55e,color:#000
  classDef vec fill:#eebefa,stroke:#ec4899,color:#000
  classDef store fill:#c3fae8,stroke:#06b6d4,color:#000
  classDef rank fill:#ffd8a8,stroke:#f59e0b,color:#000
  classDef orch fill:#d0bfff,stroke:#8b5cf6,color:#000
  classDef out fill:#b2f2bb,stroke:#22c55e,color:#000
```

**Lưu vào:** `images/chatbot_hybrid_retrieval.png`

**Vị trí thêm vào ChatBot.tex:** Cuối §Hybrid Retrieval (sau mô tả SQL + Qdrant)

```latex
\begin{figure}[!htbp]
    \centering
    \includegraphics[width=1\linewidth]{chatbot_hybrid_retrieval.png}
    \caption{Luồng Hybrid Retrieval: SQL hard-filter kết hợp Qdrant semantic search}
    \label{fig:chatbot-hybrid-retrieval}
\end{figure}
\FloatBarrier
```

---

### Hình 4: `user_profile_slots.png` — UserProfile Structure

**Nội dung cần vẽ:** Cấu trúc UserProfile và cơ chế slot-fill:

```mermaid
%%{init: {'flowchart': {'curve': 'stepAfter'}}}%%
flowchart TB
  msg["Tin nhắn người dùng"]:::host
  up["update_profile\n(LLM extract new/changed info)"]:::orch

  subgraph PROFILE["UserProfile (in-memory per session_id)"]
    core["CoreSlots\n• budget_max ★\n• body_type ★\n• fuel_type ★\n• brand\n• condition"]:::rank
    soft["SoftPreferences\n• features[]\n• vibe"]:::note
    extra["• viewed_models[]\n• excluded_brands[]"]:::note
  end

  check{{"Core slots\ncomplete?"}}:::orch
  ask["ask_slot\n(sinh câu hỏi dẫn dắt)"]:::rank
  retrieve["hybrid_retrieve\n(tiến hành truy xuất)"]:::vec

  msg --> up --> PROFILE
  PROFILE --> check
  check -->|"Thiếu ★"| ask
  check -->|"Đủ ★"| retrieve

  classDef host fill:#a5d8ff,stroke:#4a9eed,color:#000
  classDef orch fill:#d0bfff,stroke:#8b5cf6,color:#000
  classDef rank fill:#fff3bf,stroke:#f59e0b,color:#000
  classDef note fill:#f8f9fa,stroke:#adb5bd,color:#000
  classDef vec fill:#eebefa,stroke:#ec4899,color:#000
```

**Lưu vào:** `images/user_profile_slots.png`

**Vị trí thêm vào ChatBot.tex:** Cuối §Hồ sơ người dùng

```latex
\begin{figure}[!htbp]
    \centering
    \includegraphics[width=0.9\linewidth]{user_profile_slots.png}
    \caption{Cấu trúc UserProfile và cơ chế slot-fill trong chatbot}
    \label{fig:user-profile-slots}
\end{figure}
\FloatBarrier
```

---

## Tóm tắt vị trí thêm hình vào ChatBot.tex

| # | File | Section | Vị trí cụ thể |
|---|------|---------|---------------|
| 1 | `RAG_graph.png` | §Mô hình cơ sở | Đã có — caption đã sửa ✅ |
| 2 | `chatbot_langgraph.png` | §Kiến trúc Agentic | Sau đoạn giới thiệu StateGraph 12 nodes |
| 3 | `user_profile_slots.png` | §Hồ sơ người dùng | Sau mô tả CoreSlots + ask\_slot |
| 4 | `chatbot_intent_routing.png` | §Phân loại ý định | Sau bảng 7 intent |
| 5 | `chatbot_hybrid_retrieval.png` | §Hybrid Retrieval | Sau mô tả SQL + Qdrant |

> [!TIP]
> Export nhanh nhất: Dùng [mermaid.live](https://mermaid.live), paste code, chọn **PNG** → Download. Lưu vào `car-recsys-system/do_an_cuoi_ki_1_nam_4/images/`.
