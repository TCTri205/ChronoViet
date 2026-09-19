/**
 * Regular expression and lexical patterns for Chat Intent Classification.
 */

// Out of Domain Patterns (Cooking recipes, Stock trading, Generic coding)
export const OUT_OF_DOMAIN_PATTERNS = [
  // 1. Culinary & Cooking recipes
  /(?:hướng\s*dẫn|chỉ|dạy|bày|công\s*thức|cách|bí\s*quyết)\s+(?:tôi\s+)?(?:làm|nấu|chế\s*biến|nướng|rán|kho|luộc|hầm|xào|pha|làm\s+món)\s+(?:món|bánh|thịt|cá|canh|nước\s*chấm|nước\s*dùng|phở|bún|trà|cà\s*phê|sinh\s*tố|chè|bánh\s*mì)/i,
  /(?:bánh\s*mì\s*nướng|nồi\s*chiên\s*không\s*dầu|công\s*thức\s*nấu\s*ăn|nguyên\s*liệu\s*nấu\s*ăn|món\s*ngon\s*mỗi\s*ngày|nước\s*dùng\s*phở|nấu\s+phở\s+bò|chuẩn\s+vị\s+hà\s+nội)/i,
  // 2. Finance & Stock market trading
  /(?:mã\s+cổ\s*phiếu|cổ\s*phiếu|chứng\s*khoán|mua\s+vào\s+không|bán\s+ra\s+không|phân\s*tích\s*kỹ\s*thuật|giá\s+vàng|đầu\s*tư\s*tài\s*chính|crypto|bitcoin|tiền\s*ảo|lãi\s*suất\s*ngân\s*hàng)/i,
  // 3. Generic programming & IT troubleshooting
  /(?:hướng\s*dẫn|cách|làm\s*sao\s*để|viết\s+(?:hàm|code|chương\s*trình|script)|lập\s*trình|tính\s+dãy\s*số)\s+(?:viết\s+code|lập\s*trình|cài\s*đặt|debug|deploy|sửa\s*lỗi|tính\s+dãy\s*số\s*fibonacci|fibonacci)?.*?(?:python|javascript|typescript|c\+\+|java|react|docker|kubernetes|node|sql|css|html|fibonacci)/i,
  /(?:hàm\s+python|viết\s+hàm\s+python|dãy\s*số\s*fibonacci|đệ\s*quy\s*có\s*nhớ)/i,
];

// Pure Chitchat & Greeting Patterns
export const PURE_CHITCHAT_PATTERNS = [
  /^(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|nhé|nhe|nha|ạ|\w+)){0,4}$/i,
  /^(?:hello|hi|hey|alo|halo)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ|ơi|\w+)){0,4}$/i,
  /^(?:good\s+(?:morning|evening|afternoon|night))$/i,
  /^(?:rất\s+)?(?:cảm\s+ơn|cam\s+on|thank\s*you|thanks|thx)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhiều|nhe|nhé|nha|ạ|\w+)){0,4}$/i,
  /^(?:tạm\s+biệt|tam\s+biet|bye|goodbye|bye\s+bye|hẹn\s+gặp\s+lại)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ))?$/i,
  /(?:xin\s+)?chào(?:\s+bạn|\s+bot|\s+chronoviet)?[\s,;:!?-]+(?:bạn\s+là\s+ai|có\s+thể\s+giúp\s+gì|giúp\s+gì\s+cho\s+tôi|bạn\s+tên\s+gì)/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu|mày)\s+là\s+ai(?:\s+(?:thế|vậy|hả|nhỉ|dạ|\?))?$/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu|mày)\s+tên\s+(?:là\s+)?gì(?:\s+(?:thế|vậy|hả|nhỉ|dạ|\?))?$/i,
  /^(?:(?:hệ\s*thống\s+)?chronoviet\s+có\s+(?:những\s+)?(?:tính\s*năng|chức\s*năng|khả\s*năng|điểm)\s+gì|tính\s*năng\s+(?:của\s+)?(?:chronoviet|hệ\s*thống)|bạn\s+có\s+thể\s+làm\s+(?:được\s+)?gì)/i,
  /^(?:phạm\s*vi\s+(?:tra\s*cứu|hỗ\s*trợ|kiến\s*thức|hoạt\s*động)|khả\s*năng\s+tra\s*cứu|bạn\s+có\s+thể\s+(?:giúp|làm)\s+(?:được\s+)?gì|bạn\s+(?:biết\s+gì|giúp\s+được\s+gì|làm\s+được\s+gì))/i,
  /(?:phạm\s*vi\s+tra\s*cứu\s+(?:của\s+)?(?:bạn|bot|chronoviet|hệ\s*thống))/i,
  /^(?:chronoviet\s+là\s+gì|giới\s+thiệu\s+(?:về\s+)?(?:bản\s+thân|bạn|chronoviet)|hướng\s+dẫn(?:\s+sử\s+dụng)?|giúp\s+tôi\s+với|help)$/i,
];

// Conversational Bot Identity & Persona Inquiry Patterns
export const BOT_IDENTITY_PATTERNS = [
  /^(?:(?:cho\s+(?:mình|minh|tôi|toi|em)\s+hỏi|hỏi\s+chút|hỏi\s+xíu|làm\s+ơn\s+cho\s+biết|lam\s+on\s+cho\s+biet|phiền\s+bạn|phien\s+ban)\s*,?\s*)?(?:(?:xin\s+)?chào|chao|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|ban|bot|chronoviet|ad|admin|cậu|cau|mày|may)\s+(?:là\s+ai|la\s+ai|tên\s+(?:là\s+)?gì|ten\s+(?:la\s+)?gi)(?:\s+(?:thế|the|vậy|vay|hả|ha|nhỉ|nhi|dạ|da|nhờ|nho|\?))?$/i,
  /^(?:(?:cho\s+(?:mình|minh|tôi|toi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)\s*,?\s*)?(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|ban|bot|chronoviet|ad|admin|cậu)\s+tên\s+(?:là\s+)?gì(?:\s+(?:thế|the|vậy|vay|hả|ha|nhỉ|dạ|\?))?$/i,
  /^(?:who\s+are\s+you|who\s+is\s+chronoviet|what\s+is\s+chronoviet)\b/i,
  /^(?:ai\s+đấy|ai\s+đó|ai\s+thế|ai\s+vậy|ai\s+day|ai\s+the|ai\s+vay)(?:\s*\?)?$/i,
];

// Shadow chitchat patterns (normalized via text-utils removeVietnameseAccents)
export const SHADOW_CHITCHAT_PATTERNS: RegExp[] = [];

// Pleasantry Prefix Regex
export const PLEASANTRY_PREFIX_REGEX = /^(?:xin\s+chào|chào\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai)?|chào|hello|hi|hey|alo|halo|cho\s+(?:mình|tôi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)(?:[\s,;:!?-]+)/i;

// Secondary Greeting / Pleasantry / Bot Identity Clauses
export const SECONDARY_GREETING_PREFIX_REGEX =
  /^(?:(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai))?|hello|hi|hey|alo|halo)(?:[\s,;:!?-]+(?:bạn\s+là\s+ai|bạn\s+tên\s+(?:là\s+)?gì|bạn\s+có\s+thể\s+(?:làm|giúp)\s+(?:được\s+)?gì(?:\s+cho\s+tôi)?))?(?:[\s,;:!?-]+(?:và|với|cùng|nhân\s+tiện|tiện\s+thể|cho\s+(?:mình|tôi|em)\s+hỏi|hãy\s+cho\s+(?:mình|tôi|em)\s+biết|cho\s+biết|bạn\s+có\s+thể\s+cho\s+(?:tôi|mình|em)\s+biết))?\s*/i;

export const SECONDARY_BOT_IDENTITY_PREFIX_REGEX =
  /^(?:(?:cho\s+(?:mình|tôi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)\s*,?\s*)?(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu)\s+(?:là\s+ai|tên\s+(?:là\s+)?gì|có\s+thể\s+giúp\s+gì(?:\s+cho\s+tôi)?)(?:[\s,;:!?-]+(?:và|với|cùng|nhân\s+tiện|tiện\s+thể|hãy\s+cho\s+(?:tôi|em|mình)\s+biết|cho\s+biết|bạn\s+có\s+thể\s+cho\s+(?:tôi|mình|em)\s+biết))?\s*/i;

// Secondary Video Generation Suffix Clauses
export const SECONDARY_VIDEO_SUFFIX_REGEX =
  /(?:[\s,;:!?-]+(?:và|đồng\s*thời|tiện\s*thể|nhân\s*tiện)?\s*(?:hãy\s+)?(?:tạo|làm|dựng|sản\s*xuất|generate|make)\s+(?:cho\s+tôi\s+)?(?:video|clip|phim|thước\s*phim)(?:\s+(?:về\s+(?:chủ\s+đề\s+này|nó|sự\s+kiện\s+này|nhân\s+vật\s+này)|ngắn|chi\s+tiết))?(?:\s+(?:giúp\s+tôi|nhé|nhe|nha|ạ|với))?[\s.?!]*)$/i;

// Secondary Out-of-Domain Suffix Clauses
export const SECONDARY_OOD_SUFFIX_REGEX =
  /(?:[\s,;:!?-]+(?:và\s+)?(?:nhân\s*tiện|tiện\s*thể|đồng\s*thời)?\s*(?:chỉ|hướng\s*dẫn|dạy|bày|nói|cho\s+(?:tôi|mình|em)\s+biết)\s+(?:cách\s+|công\s*thức\s+)?(?:tôi\s+)?(?:làm|nấu|chế\s*biến|pha|nướng|viết\s+code|đầu\s*tư).*)$/i;

// Primary Video Intent Prefix
export const PRIMARY_VIDEO_START_REGEX =
  /^(?:(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)(?:\s+[a-zà-ỹ\w]+)?[\s,;:!?-]+)?(?:hãy\s+|bạn\s+có\s+thể\s+|giúp\s+tôi\s+)?(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make|edit|chỉnh\s*sửa|chuyển|tổng\s*hợp|video\s*brief)\b/i;

export const VIDEO_INTENT_PATTERNS = [
  /(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make|edit|chỉnh\s*sửa)(?:\s+[\wà-ỹ]+){0,4}\s+(?:video|clip|phim|thước\s*phim|dự\s*án\s*video|kịch\s*bản\s*video)(?:\s+(?:về|về\s+chủ\s+đề|kể\s+về))?\s*(.+)?/i,
  /(?:chuyển|tổng\s*hợp)\s+(?:thành|sang)\s+video\s*(.+)?/i,
  /(?:video\s*brief|tạo\s*kịch\s*bản\s*video)\s*(.+)?/i,
  /(?:phân\s*cảnh|chỉnh\s*sửa\s*phân\s*cảnh|kéo\s*dài\s*thêm|đổi\s*layout)/i,
];

// Kinship, lineage, and family relations patterns
export const KINSHIP_AND_RELATION_REGEX =
  /(?:(?:2|hai)?\s*anh\s+em(?:\s+ruột)?|chị\s+em(?:\s+ruột)?|cha\s+con|mẹ\s+con|vợ\s+chồng|huynh\s+đệ|tỷ\s+muội|đồng\s+môn|thầy\s+trò|tướng\s+sĩ|quân\s+thần|dòng\s+họ|tông\s+tộc|anh\s+hùng|anh\s+ruột|em\s+ruột|anh\s+trai|em\s+trai|chị\s+gái|em\s+gái|ông\s+cháu|bà\s+cháu|tiền\s+bối|hậu\s+duệ|thân\s+tộc|phả\s+hệ|tổ\s+tiên|huyết\s+thống|cột\s+chèo)/i;

// Substantive interrogative syntax
export const SUBSTANTIVE_QUESTION_REGEX =
  /(?:có\s+phải(?:\s+là)?|phải\s+chăng|là\s+ai|ở\s+đâu|khi\s+nào|thời\s+nào|năm\s+nào|tại\s+sao|vì\s+sao|như\s+thế\s+nào|ra\s+sao|mấy\s+người|bao\s+nhiêu|ai\s+là|vị\s+vua|vị\s+tướng|nhân\s+vật|sự\s+kiện|chiến\s+công|công\s+tích|diễn\s+biến|kế\s+sách|trận\s+đánh)(?:$|[\s,;:.!?])/i;

// Direct second-person address or personal chitchat aimed at the bot persona
export const DIRECT_CONVERSATIONAL_ADDRESS_REGEX =
  /(?:^(?:ơi\s+)?(?:bạn|bot|chronoviet|cậu|mày|ad|admin)\b|\b(?:ơi\s+)?(?:bạn|bot|chronoviet|cậu|mày|ad|admin)(?:$|[\s,;:.!?])|^(?:anh|em|chị)\s+ơi\b|\b(?:anh|em|chị)\s+ơi(?:$|[\s,;:.!?])|\b(?:tôi|mình|em)\s+(?:có\s+\d+\s+câu\s+hỏi\s+về\s+bạn|buồn|vui|chán|mệt|đang\s+rảnh|thích|ghét)\b)/i;

// Casual chat remarks
export const CASUAL_REMARK_REGEX =
  /(?:^|[\s,;:.!?])(?:nhà\s+lên\s+giá|giá\s+(?:nhà|xăng|vàng|đất|xe)|thời\s+tiết|trời\s+(?:nắng|mưa|đẹp|lạnh|nóng|âm\s+u|gió)|hôm\s+nay\s+(?:mệt|vui|buồn|chán|bận)|mệt\s+mỏi|chán\s+(?:quá|ghê|thế)|buồn\s+(?:quá|ngủ)|vui\s+quá|đói\s+bụng|đi\s+(?:ngủ|ăn|chơi)|chúc\s+ngủ\s+ngon|ha\s*ha|hi\s*hi|hê\s*hê|cũng\s+được|thế\s+à|vậy\s+à|ừ\s+nhỉ|ok\s+bạn|được\s+đấy)(?:$|[\s,;:.!?])|(?:\b(?:quá|lắm|ghê)\b.*(?:\b(?:nhỉ|nhe|nhé|nha|thế)\b)?$)/i;

// Conjunction / Coordinate Entity Query Patterns
export const CONJUNCTION_ENTITY_PATTERNS = [
  /^(?:có\s+phải\s+)?(.+?)\s+(?:và|với|cùng)\s+(.+?)\s+là\s+(?:ai|những\s+ai|người\s+như\s+thế\s+nào)(?:\s*\?)?$/i,
  /^(?:quan\s+hệ\s+giữa|mối\s+quan\s+hệ\s+giữa)\s+(.+?)\s+(?:và|với)\s+(.+?)(?:\s+là\s+gì|\s+như\s+thế\s+nào)?(?:\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+(?:mối\s+)?quan\s+hệ(?:\s+[\wà-ỹ]+)?\s+(?:gì|như\s+thế\s+nào|ra\s+sao)(?:\s*\?)?$/i,
  /^(?:có\s+phải\s+)?(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau|(?:2|hai)?\s*anh\s+em(?:\s+ruột)?)(?:\s*không|\s+hay\s+không|\s+phải\s+không|\s+hả|\s*\?)?$/i,
  /^(?:có\s+phải\s+)?(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một)\s+(?:hay|hoặc)\s+(?:là\s+)?(?:2|hai)?\s*(?:vị\s+vua|người|nhân\s+vật)\s+khác\s+nhau(?:.*)$/i,
  /^(?:có\s+phải\s+)?(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một|hai\s+người\s+khác\s+nhau|hai\s+vị\s+vua\s+khác\s+nhau)(?:.*)$/i,
  /^(.+?)\s+có\s+phải\s+(?:là\s+)?(?:con|cha|anh|em|vợ|chồng|cháu)\s+(?:của|với)\s+(.+?)(?:\s*không|\s*\?)?$/i,
  /^(.+?)\s+là\s+(?:con|cha|anh|em|vợ|chồng|cháu)\s+(?:của|với)\s+(.+?)(?:\s*không|\s*\?)?$/i,
];

export const SINGLE_ENTITY_IDENTITY_PATTERNS = [
  /^([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+là\s+ai(?:\s+(?:thế|vậy|không|hả|nhỉ|ạ))?(?:\s*\?)?$/i,
  /^ai\s+là\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)(?:\s+(?:thế|vậy|không|hả|nhỉ|ạ))?(?:\s*\?)?$/i,
  /^([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+có\s+phải\s+(?:là\s+)?([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)(?:\s*không|\s*\?)?$/i,
  /^tên\s+thật\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+(?:là\s+gì|\?)/i,
  /^quê\s+quán\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+(?:ở\s+đâu|\?)/i,
];

export const CONVERSATIONAL_STOPWORDS = new Set([
  'bạn', 'ban', 'banj', 'tôi', 'toi', 'tooi', 'mình', 'minh', 'minhj', 'cậu', 'cau', 'em', 'anh', 'chị', 'chi',
  'bot', 'ad', 'admin', 'ai', 'gì', 'gi', 'nào', 'nao', 'sao', 'đâu', 'dau', 'thế', 'the',
  'vậy', 'vay', 'chào', 'chao', 'hello', 'hi', 'hey', 'alo', 'halo', 'cảm ơn', 'cam on',
  'tạm biệt', 'tam biet', 'hỏi', 'hoi', 'biết', 'biet', 'nghe', 'nói', 'noi', 'làm', 'lam',
  'cho', 'về', 've', 'là', 'la', 'laf', 'có', 'co', 'được', 'duoc', 'xin'
]);
