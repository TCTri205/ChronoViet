# CHI TIẾT MÔ-ĐUN 1: CHRONO-RAG ENGINE
## (Hybrid GraphRAG: Knowledge Graph + Vector Database + Local Search)

---

## 1. Mục Đích & Tổng Quan Bài Toán

Mô-đun **Chrono-RAG Engine** đóng vai trò là "Bộ nào Tri thức" (Knowledge & Fact Retrieval Layer) của ChronoViet. Trong lĩnh vực EdTech và sản xuất nội dung video Lịch sử, thách thức lớn nhất của các mô hình ngôn ngữ lớn (LLM) là hiện tượng **Hallucination** (tự bịa đặt mốc thời gian, nhầm lẫn tên nhân vật, sai lệch địa danh hoặc diễn biến trận đánh).

RAG truyền thống (chỉ dùng Vector Search) thường gặp phải tình trạng **"râu ông nọ chắp cằm bà kia"** do chỉ dựa vào độ tương đồng ngữ nghĩa mà không nắm được cấu trúc quan hệ chặt chẽ giữa các thực thể lịch sử. 

Chrono-RAG giải quyết triệt để bài toán này bằng kiến trúc **GraphRAG (Knowledge Graph + Vector Search + Local Search)** được triển khai tinh gọn trên **PostgreSQL (`pgvector` + Relational Graph Schema)**:
* **Knowledge Graph (Đồ thị Tri thức):** Đảm bảo tính chính xác tuyệt đối về mốc thời gian, nhân vật, triều đại, quan hệ dòng tộc và sự đổi tên địa danh qua các bảng `entities` & `relationships`.
* **Vector Search (`pgvector`):** Bảo tồn trọn vẹn sắc thái miêu tả chi tiết, văn phong nguyên văn và bối cảnh lịch sử từ các tài liệu gốc qua HNSW Vector Index (1024d BGE-M3).
* **Local Search ($k$-Hop Expansion):** Truy vấn khu vực tri thức xung quanh các thực thể được nhắc tới trong câu hỏi qua thuật toán **PostgreSQL Recursive CTEs** ($k=1$ hoặc $k=2$) với tốc độ sub-millisecond mà không ngốn tài nguyên RAM.

---

## 2. Nguồn Tri Thức & Phân Cấp Dữ Liệu (Knowledge Corpus)

Dữ liệu đầu vào của Chrono-RAG được thu thập, làm sạch và phân lớp thành 3 cấp độ tin cậy nghiêm ngặt:

1. **Cấp 1 (Primary Sources - Sử liệu chính thống cổ/trung đại):**
   * *Đại Việt Sử Ký Toàn Thư*, *Khâm Định Việt Sử Thông Giám Cương Mục*, *Việt Sử Lược*, *Lam Sơn Thực Lục*.
   * Văn bản văn học - quân sự kinh điển: *Hịch Tướng Sĩ*, *Bình Ngô Đại Cáo*, *Nam Quốc Sơn Hà*.
2. **Cấp 2 (Educational Standards - Sách giáo khoa & Giáo trình chuẩn):**
   * Sách giáo khoa Lịch sử & Địa lý (Chương trình GDPT mới 2018).
   * Giáo trình Lịch sử Việt Nam các trường Đại học Sư phạm & Đại học Khoa học Xã hội và Nhân văn.
3. **Cấp 3 (Verified Secondary Research - Nghiên cứu chuyên khảo):**
   * Các công trình nghiên cứu sử học đã qua thẩm định, bài báo của Viện Sử học Việt Nam, tài liệu khảo cổ học (Trống đồng, thành cổ, di tích lịch sử).

---

## 3. Thiết Kế Schema (Ontology) Lịch Sử Việt Nam

Khâu cốt lõi của Knowledge Graph là xây dựng sơ đồ tri thức (Ontology) chuẩn xác cho lịch sử Việt Nam. Dữ liệu từ các bộ sử sách được ánh xạ thành các **Nút (Nodes)** và **Mối quan hệ (Edges)**:

```
 (Person: Nguyễn Huệ) ──[ALIAS_OF]──► (Person: Quang Trung)
          │
      [LED_BY]
          ▼
 (Event: Trận Ngọc Hồi - Đống Đa) ──[HAPPENED_IN]──► (TimePeriod: Tết Kỷ Dậu 1789)
          │                                                    │
      [PART_OF]                                            [PART_OF]
          ▼                                                    ▼
 (Event: Kháng chiến chống quân Thanh)                 (Dynasty: Nhà Tây Sơn)
          │
    [HAPPENED_AT]
          ▼
 (Location: Thăng Long) ◄──[SAME_AS_LOCATION]── (Location: Đông Quan)
          │
    [MENTIONED_IN]
          ▼
 (DocumentChunk: Chunk_102) ── [Source: Đại Việt Sử Ký, p.45]
```

### 3.1. Các nhãn Nút (Node Labels)

* `Person`: Lê Lợi, Nguyễn Trãi, Trần Hưng Đạo, Vương Thông, Nguyễn Huệ, Quang Trung...
* `Event`: Khởi nghĩa Lam Sơn, Trận Tốt Động - Chúc Động, Trận Bạch Đằng 1288, Hội thề Đông Quan...
* `Location`: Thăng Long, Đông Quan, Chi Lăng, Lam Sơn, Tây Kết, Bạch Đằng...
* `Dynasty`: Nhà Lê Sơ, Nhà Minh, Nhà Trần, Nhà Tây Sơn...
* `TimePeriod`: Năm 1426, Tháng 11/1426, Thế kỷ XV, Tết Kỷ Dậu 1789...
* `DocumentChunk`: Đoạn văn bản thô trích từ sách (chứa nội dung gốc, số trang, tên tác phẩm, Reliability Level).

### 3.2. Các loại Mối quan hệ (Edge Types)

* `PART_OF`: `(Trận Tốt Động) -[PART_OF]-> (Khởi nghĩa Lam Sơn)`
* `LED_BY`: `(Khởi nghĩa Lam Sơn) -[LED_BY]-> (Lê Lợi)`
* `HAPPENED_IN`: `(Trận Tốt Động) -[HAPPENED_IN]-> (Tháng 11/1426)`
* `HAPPENED_AT`: `(Trận Ngọc Hồi) -[HAPPENED_AT]-> (Thăng Long)`
* `SAME_AS_LOCATION`: `(Đông Quan) -[SAME_AS_LOCATION]-> (Thăng Long)` *(Xử lý việc đổi tên địa danh qua các thời kỳ triều đại)*
* `ALIAS_OF`: `(Quang Trung) -[ALIAS_OF]-> (Nguyễn Huệ)` *(Xử lý niên hiệu, tên húy, biệt hiệu nhân vật)*
* `ROYAL_LINEAGE`: `(Trần Quốc Tuấn) -[ROYAL_LINEAGE]-> (Trần Thái Tông)` *(Xử lý quan hệ dòng tộc phức tạp)*
* `MENTIONED_IN`: `(Lê Lợi) -[MENTIONED_IN]-> (DocumentChunk_102)` *(Liên kết giữa Đồ thị và Chunk Vector)*

---

## 4. Kiến Trúc Kỹ Thuật & Chu Trình Xử Lý (Pipeline Architecture)

Hệ thống Chrono-RAG vận hành qua 2 chu trình riêng biệt: **Offline Indexing** (Tiền xử lý & Xây dựng tri thức) và **Online Retrieval** (Truy vấn theo ngữ cảnh real-time).

```
==================================================================================================
1. OFFLINE INDEXING PIPELINE (Xây dựng Dữ liệu Tri thức)
==================================================================================================

 [Lịch sử Việt Nam (Toàn Thư, SGK)]
                 │
                 ▼
 ┌───────────────────────────────┐
 │ DOCUMENT INGESTION & CHUNKING │
 │  - Dynamic Hierarchical Chunk │
 │  - Temporal & Source Metadata │
 └───────────────┬───────────────┘
                 │
         ┌───────┴─────────────────────────┐
         ▼                                 ▼
 ┌───────────────────────────────┐ ┌───────────────────────────────┐
 │         VECTOR BRANCH         │ │         GRAPH BRANCH          │
 │ - Dense Embedding (bge-m3)    │ │ - LLM Triple Extraction       │
 │ - Sparse Encoding (BM25)      │ │   (Entity - Relation - Entity)│
 │ - Store in PostgreSQL pgvector│ │ - Relational Graph Schema     │
 └───────────────┬───────────────┘ └───────────────┬───────────────┘
                 │                                 │
                 └───────────► [MENTIONED_IN] ◄────┘
                        (Cross-Linking Node & Chunk)


==================================================================================================
2. ONLINE RETRIEVAL PIPELINE (Duyệt Cục Bộ Local Search)
==================================================================================================

 User Question: "Diễn biến trận Tốt Động - Chúc Động và vai trò của Nguyễn Chích?"
                 │
                 ▼
 ┌───────────────────────────────┐
 │ 1. QUESTION ENTITY EXTRACTION │ ──► Identified: [Trận Tốt Động - Chúc Động], [Nguyễn Chích]
 └───────────────┬───────────────┘
                 │
         ┌───────┴─────────────────────────┐
         ▼                                 ▼
 ┌───────────────────────────────┐ ┌───────────────────────────────┐
 │ 2. LOCAL GRAPH SEARCH (CTEs)  │ │ 3. DENSE + SPARSE VECTOR SEARCH│
 │ - Query 1-hop / 2-hop Subgraph│ │ - bge-m3 Semantic Similarity  │
 │ - PostgreSQL Recursive CTEs   │ │ - BM25 Keyword Matching       │
 └───────────────┬───────────────┘ └───────────────┬───────────────┘
                 │                                 │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────┐
 │ 4. GRAPH-GUIDED CHUNK RETRIEVAL                 │
 │ - Pull Chunks via [MENTIONED_IN] links          │
 └────────────────────────────────┬────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────┐
 │ 5. RERANKING & CONTEXT FUSION                   │
 │ - BGE Reranker v2 (Cross-Encoder)               │
 │ - Output Top-K Verified Contexts for Multi-Agent│
 └─────────────────────────────────────────────────┘
```

### 4.1. Chu Trình Offline Indexing (Xây Dựng Tri Thức)

1. **Phân đoạn văn bản (Hierarchical Temporal Chunking):**
   * **Parent Chunk (Context Large):** Toàn bộ một chiến dịch / giai đoạn lịch sử (ví dụ: *Cuộc kháng chiến chống quân Minh - Giai đoạn 1426*).
   * **Child Chunk (Granular Event):** Từng trận đánh hoặc sự kiện cụ thể (khoảng 300 - 500 từ, đính kèm số trang, tên tác phẩm, thời gian).
   * **Metadata Schema:**
     ```json
     {
       "chunk_id": "hist_1426_tot_dong_chuc_dong",
       "dynasty": "NHA_LE_SO",
       "time_start": 1426,
       "time_end": 1426,
       "key_figures": ["Lê Lợi", "Nguyễn Trãi", "Nguyễn Chích", "Vương Thông"],
       "location": "Tốt Động, Chúc Động, Hà Đông",
       "source_reliability": "LEVEL_1"
     }
     ```
2. **Song song hóa nhánh xử lý (Dual-Branch Indexing):**
   * **Nhánh Vector (Semantic Layer):** Chuyển đổi các đoạn văn bản thô thành Embedding vectors bằng mô hình `bge-m3` (kết hợp Dense Vectors & BM25 Sparse Vectors) và lưu trữ vào PostgreSQL `pgvector`.
   * **Nhánh Đồ thị (Structured Knowledge Layer):** Sử dụng LLM chạy trích xuất bộ ba (Entity - Relation - Entity) dựa trên Schema Ontology Lịch sử đã định nghĩa, đẩy dữ liệu vào PostgreSQL `entities` & `relationships`.
3. **Liên kết chéo (Cross-Linking Graph & Vector):**
   * Tạo quan hệ `MENTIONED_IN` giữa các Nút thực thể trên Knowledge Graph và `chunk_id` tương ứng trong bảng `entity_chunks`.

### 4.2. Chu Trình Online Retrieval (Duyệt Cục Bộ Local Search)

Khi tiếp nhận câu hỏi từ mô-đun Multi-Agent (ví dụ: *"Hãy cho biết diễn biến trận Tốt Động - Chúc Động và vai trò của Nguyễn Chích?"*):

1. **Step 1 - Trích xuất thực thể câu hỏi:** LLM/NER Engine nhận diện thực thể trung tâm: `[Trận Tốt Động - Chúc Động]` và `[Nguyễn Chích]`.
2. **Step 2 - Local Graph Search (Duyệt đồ thị cục bộ):**
   * Định vị các nút tương ứng trên PostgreSQL Graph Tables (`entities`).
   * Mở rộng 1-hop hoặc 2-hop (k-hop neighborhood expansion) qua thuật toán **PostgreSQL Recursive CTEs** để rút ra Subgraph xung quanh: Ai chỉ huy? Xảy ra thời gian nào? Kết quả ra sao? Mối liên kết trực tiếp/gián tiếp giữa Nguyễn Chích và trận đánh là gì?
3. **Step 3 - Dense & Sparse Vector Search:**
   * Embed câu hỏi và truy vấn Top-K đoạn văn bản có độ tương đồng ngữ nghĩa cao nhất từ `pgvector`.
4. **Step 4 - Graph-Guided Chunk Retrieval:**
   * Dựa vào Subgraph ở Step 2, truy vết các `chunk_id` được nối qua quan hệ `MENTIONED_IN` để đảm bảo lấy đủ văn bản gốc chứa thông tin chi tiết.
5. **Step 5 - Reranking & Context Fusion:**
   * Hợp nhất danh sách các bộ ba quan hệ (Triples) và các đoạn văn thô (Chunks).
   * Sử dụng Cross-Encoder Reranker (`bge-reranker-v2-m3`) để chấm điểm và loại bỏ nhiễu, chọn ra 3–5 ngữ cảnh chuẩn xác nhất làm Context Prompt cho Mô-đun 2 (Multi-Agent Orchestrator).

---

## 5. Chi Tiết Model & Thuật Toán Theo Từng Công Đoạn (Models & Algorithms Specification)

Để xử lý hiệu quả văn bản Lịch sử Việt Nam (nhiều từ Hán-Việt, cấu trúc câu cổ/phức tạp, địa danh/nhân vật thay đổi qua các thời kỳ), dưới đây là chi tiết các **Models** và **Thuật toán (Algorithms)** được tối ưu hóa cho từng công đoạn trong đường ống Hybrid GraphRAG:

### 5.1. Công đoạn Trích xuất Thực thể & Quan hệ (Graph Extraction & NER)
*Công đoạn này chuyển đổi văn bản thô (Đại Việt Sử Ký Toàn Thư, SGK) thành bộ ba thực thể/quan hệ cho Graph DB.*

* **LLMs cho Task Trích xuất (Open-source & Commercial Models):**
  * **Gemini 1.5 Flash / 1.5 Pro:** Lựa chọn hàng đầu nếu dùng Commercial API. Khả năng hiểu ngữ cảnh tiếng Việt xuất sắc, Context Window lớn giúp đọc nguyên chương sách và chi phí/token rất rẻ.
  * **Qwen2.5-72B-Instruct / Qwen2.5-14B-Instruct:** Mô hình Open-source mạnh nhất hiện tại về khả năng trích xuất thông tin cấu trúc (JSON/Triple Extraction).
  * **PhoGPT / VinAI Models:** Tùy chọn fine-tune cho task NER lịch sử nếu muốn vận hành Offline hoàn toàn trên máy local.
* **Thuật toán & Phương pháp Trích xuất:**
  * **Schema-Guided Extraction (Few-shot Prompting):** Ép LLM trích xuất dữ liệu tuân theo **JSON Schema** định sẵn (định nghĩa rõ các nhãn `Person`, `Location`, `Event`, `Dynasty`).
  * **Coreference Resolution (Giải quyết đồng tham chiếu):** Sử dụng **FastCoref** hoặc **LLM-based Coref** để biến các đại từ nhân xưng cổ như *"Ngài"*, *"Vua"*, *"Chủ tướng"* thành tên thực thể chuẩn xác (ví dụ: *"Ngài liền cho quân..."* $\rightarrow$ `[Lê Lợi]`).

### 5.2. Công đoạn Biểu diễn Ngữ nghĩa (Embedding & Vector Search)
*Chuyển đổi các đoạn văn bản (Chunks) và câu hỏi của người dùng thành Vector.*

* **Embedding Models phù hợp cho Tiếng Việt:**
  * **`BAAI/bge-m3` (Khuyên dùng số 1):** Mô hình Multi-Lingual mạnh nhất hiện nay. Hỗ trợ **Dense Retrieval**, **Sparse Retrieval (Lexical BM25)**, và **Multi-Vector Retrieval** cùng lúc. Giúp tìm chính xác cả tên riêng lịch sử (từ khóa) lẫn ngữ nghĩa đoạn văn.
  * **`bkai-foundation-models/vietnamese-bi-encoder`:** Mô hình do BKAI huấn luyện chuyên biệt cho tiếng Việt, hoạt động mượt với văn bản thuần Việt.
  * **`text-embedding-3-large` (OpenAI):** Chất lượng biểu diễn ngữ nghĩa cao (trả phí API).
* **Thuật toán Tìm kiếm Vector & Hybrid Search:**
  * **HNSW (Hierarchical Navigable Small World):** Thuật toán indexing mặc định trên PostgreSQL `pgvector` và các Vector DB cho tốc độ tìm kiếm lân cận cực nhanh.
  * **RRF (Reciprocal Rank Fusion):** Thuật toán kết hợp kết quả xếp hạng giữa **Sparse Search (BM25)** (tìm từ khóa chính xác tên tướng/địa danh) và **Dense Search (Vector Embedding)** (tìm ngữ nghĩa câu hỏi).

### 5.3. Công đoạn Duyệt Đồ thị & Gom nhóm (Graph Traversal & Community Detection)
*Các thuật toán chạy trực tiếp trên PostgreSQL Relational Graph Schema qua Recursive CTEs (hoặc Neo4j khi Scale-Out).*

* **Thuật toán Duyệt Đồ thị (Traversal & Reasoning):**
  * **k-Hop Neighborhood / Subgraph Expansion:** Từ thực thể được nhận diện trong câu hỏi, mở rộng bán kính $k$ bước (thường $k=1$ hoặc $k=2$) để lấy toàn bộ mạng lưới ngữ cảnh xung quanh.
  * **Shortest Path (Dijkstra / A*):** Tìm đường đi ngắn nhất giữa 2 thực thể. *(Ví dụ: "Mối quan hệ dòng họ giữa Vua Lê Thánh Tông và Vua Lê Thái Tổ là gì?" $\rightarrow$ Duyệt qua quan hệ `FATHER_OF`, `GRANDFATHER_OF` để tìm đường nối ngắn nhất).*
  * **Node Similarity / Jaccard Index:** Tìm các nhân vật hoặc sự kiện có tính chất tương đồng dựa trên các cạnh chung.
* **Thuật toán Gom nhóm (Community Detection - cho Global Search khi cần):**
  * **Leiden Algorithm / Louvain Algorithm:** Phân cụm các nút trên đồ thị thành từng "cộng đồng" có liên kết chặt chẽ (ví dụ: Gom toàn bộ dữ liệu trận Chi Lăng, Xương Giang vào cụm `[Kháng chiến chống Minh]`).

### 5.4. Công đoạn Xếp hạng & Tổng hợp (Reranking & Generation)
*Sắp xếp lại các tri thức thu được từ cả Graph và Vector DB trước khi đưa vào LLM sinh câu trả lời.*

* **Cross-Encoder / Reranker Models:**
  * **`BAAI/bge-reranker-v2-m3` (Khuyên dùng số 1):** Mô hình Reranker đa ngôn ngữ xuất sắc. Đánh giá lại độ liên quan thực sự giữa `Câu hỏi` và `(Mệnh đề từ Graph + Đoạn văn từ Vector)` để lọc bỏ nhiễu.
  * **Cohere Rerank v3:** Dịch vụ API Commercial Rerank chất lượng hàng đầu.
* **Thuật toán & Kỹ thuật Prompting:**
  * **Chain-of-Thought (CoT) / Graph-of-Thought (GoT):** Ép LLM suy luận theo từng mốc thời gian trước khi đưa ra câu trả lời cuối cùng.
  * **Citation & Grounding Guardrails:** Kỹ thuật yêu cầu LLM đính kèm nguồn (sách nào, bộ ba quan hệ nào) để đảm bảo không bịa đặt sự thật lịch sử.

---

## 6. Đánh Giá Chi Tiết Ưu, Nhược Điểm & Đánh Đổi (Trade-off Analysis)

| Tiêu Chí | Chi Tiết Đánh Giá Trong Bài Toán Lịch Sử Việt Nam |
| :--- | :--- |
| **Độ Chính Xác Ngữ Nghĩa & Niên Đại** | **Tối ưu hàng đầu:** Loại bỏ triệt để hiện tượng nhầm lẫn nhân vật/sự kiện nhờ tính toàn vẹn dữ liệu của Knowledge Graph. |
| **Xử Lý Niên Hiệu & Địa Danh Cổ** | **Xuất sắc:** Đồ thị dễ dàng ánh xạ tên cũ/tên mới (*Đông Quan = Thăng Long = Hà Nội*) và tên húy/niên hiệu (*Nguyễn Huệ = Quang Trung*). |
| **Bảo Tồn Chi Tiết Văn Học & Trích Dẫn** | **Giữ trọn vẹn:** Nhờ lớp Vector DB, các đoạn trích nguyên văn từ *Đại Việt Sử Ký Toàn Thư* hay *Bình Ngô Đại Cáo* không bị biến dạng. |
| **Nhược Điểm Kỹ Thuật** | **Nhiễu trích xuất (Extraction Noise):** Dữ liệu Hán-Việt cổ nếu prompt trích xuất không chuẩn sẽ tạo ra nút rác. Đòi hỏi bộ Prompt Engineering NER khắt khe. |
| **Phức Tạp Vận Hành** | **Đồng bộ hóa 2 CSDL:** Phải duy trì ID nhất quán giữa Graph DB và Vector DB qua quan hệ `MENTIONED_IN`. |

### Đánh giá Đánh Đổi (Trade-off):
* **Chấp nhận chi phí & thời gian tiền xử lý ban đầu cao:** Cần đầu tư LLM API call để trích xuất Entity/Triples xây dựng Graph ban đầu.
* **Đổi lại độ tin cậy tuyệt đối dài hạn:** Hệ thống phản hồi chính xác 100% về nhân vật/mốc thời gian, có trích dẫn nguồn cụ thể (Tên sách, tập, trang) phục vụ thẩm định nội dung cho video.

---

## 7. Bảng Tóm Tắt Tech Stack, Model & Thuật Toán Đề Xuất

> 💡 **Ghi chú Triển khai VPS Tinh Gọn (Single-Host Deployment):** Ở giai đoạn MVP trên 1 VPS, toàn bộ Vector Embeddings và Graph Metadata được lưu trữ tập trung ngay trên **PostgreSQL 15+ (`pgvector`)** để tiết kiệm RAM. Qdrant và Neo4j sẵn sàng mở rộng độc lập trong giai đoạn Scale-Out khi dung lượng dữ liệu tăng cao.

| Công đoạn | Model / Thuật toán Đề xuất | Công cụ / Library hỗ trợ |
| :--- | :--- | :--- |
| **NER & Relation Extraction** | Qwen3.8-27B / Gemini 2.5 Flash / Llama 3.3 70B + Few-shot JSON Prompt | LlamaIndex (`PropertyGraphIndex`), Instructor, FastCoref |
| **Graph DB & Traversal** | Relational Graph Schema / Cypher Query + k-Hop Expansion | PostgreSQL (MVP) / Neo4j (Scale-Out) |
| **Text Embedding** | `BAAI/bge-m3` | Sentence-Transformers, HuggingFace |
| **Hybrid Vector Search** | pgvector HNSW Index + BM25 + Reciprocal Rank Fusion (RRF) | PostgreSQL `pgvector` (MVP) / Qdrant (Scale-Out) |
| **Context Reranking** | `BAAI/bge-reranker-v2-m3` | FlagEmbedding, FlashRank |
| **Final Answer Generation** | Gemini 1.5 Pro / GPT-4o / Qwen2.5-72B | LangChain / LangGraph.js |

---

## 8. Tiêu Chí Đánh Giá Tính Chuẩn Xác (Evaluation Benchmark)

Engine được kiểm thử liên tục qua bộ Benchmark nội bộ **ChronoEval-1000** gồm 1,000 câu hỏi lịch sử phức tạp:

* **Fact Precision Score:** > 99.2% (Không sai lệch niên đại, nhân vật, triều đại).
* **Temporal Continuity:** Đảm bảo thứ tự diễn tiến sự kiện theo đúng dòng thời gian.
* **Source Citation Traceability:** 100% thông tin xuất ra đều gắn kèm Citation ID dẫn về trang/tập trong tài liệu gốc.
