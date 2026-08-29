/**
 * ChronoViet - Standard Vietnamese Syllable Lexicon & Phonotactic Validator
 *
 * Contains ~6,500 valid phonetic syllables across standard Vietnamese orthography
 * with Unicode NFC normalization and phonotactic rules.
 */

// Single-letter valid words in Vietnamese that must NEVER be greedily merged into adjacent words
export const STANDALONE_SINGLE_LETTER_WORDS = new Set([
  'a',  // viên a bảo, a dua, a hoàn, a tòng
  'ả',  // ả họ Đặng, ả đào, ả em
  'e',  // e rằng, e dè, e ngại, e lệ, e ấp
  'y',  // y như, y lệnh, y án, y sĩ, y phục
  'ô',  // ô dù, ô tô, ô hay
  'ơ',  // ơ kìa, ơ hay
  'ở',  // ở đâu, ở lại, ở nhà
  'ý',  // ý kiến, ý định, ý nghĩa, ý chí
  'u',  // u uất, u tối, u uẩn
  'ê',  // ê chề, ê hề, ê a
]);

// Non-standalone phonetic fragments commonly produced by split OCR
export const NON_STANDALONE_FRAGMENTS = new Set([
  'ng', 'v', 'ươ', 'i', 'n', 't', 'c', 'tr', 'ch', 'nh', 'kh', 'ph', 'th', 'qu', 'gi', 'gh', 'ngh',
  'đ', 'd', 'b', 'm', 'l', 'r', 's', 'x', 'h', 'k', 'p', 'ư', 'ơ', 'ê', 'â', 'ă', 'uô', 'iê',
  'g', 'q', 'y', 'ên', 'iên', 'uông', 'ương', 'oan', 'oang', 'uy', 'uyên', 'uyêt', 'uyệt',
  'ung', 'ưng', 'ang', 'ăng', 'âng', 'ong', 'ông', 'anh', 'ênh', 'inh', 'êch', 'ach', 'ich',
  'ôm', 'ơm', 'iêm', 'uôm', 'ươm', 'oam', 'oăm', 'uyp', 'uynh', 'uysh'
]);

// Base Vietnamese syllables without diacritics
const BASE_SYLLABLES: string[] = [
  'a', 'ac', 'ach', 'ai', 'am', 'an', 'ang', 'anh', 'ao', 'ap', 'at', 'ay',
  'ba', 'bac', 'bach', 'bai', 'bam', 'ban', 'bang', 'banh', 'bao', 'bap', 'bat', 'bay', 'be', 'bec', 'bech', 'bem', 'ben', 'beng', 'beo', 'bep', 'bet',
  'bi', 'bia', 'bich', 'biem', 'bien', 'bieng', 'biet', 'bim', 'bin', 'binh', 'bip', 'bit', 'biu',
  'bo', 'boc', 'boi', 'bom', 'bon', 'bong', 'bop', 'bot',
  'bu', 'bua', 'buc', 'bui', 'bum', 'bun', 'bung', 'bup', 'but', 'buy',
  'ca', 'cac', 'cach', 'cai', 'cam', 'can', 'cang', 'canh', 'cao', 'cap', 'cat', 'cay',
  'ce', 'co', 'coc', 'coi', 'com', 'con', 'cong', 'coo', 'cop', 'cot',
  'cu', 'cua', 'cuc', 'cue', 'cui', 'cum', 'cun', 'cung', 'cuo', 'cup', 'cut',
  'cha', 'chac', 'chach', 'chai', 'cham', 'chan', 'chang', 'chanh', 'chao', 'chap', 'chat', 'chay',
  'che', 'chec', 'chech', 'chem', 'chen', 'cheng', 'cheo', 'chep', 'chet',
  'chi', 'chia', 'chich', 'chiem', 'chien', 'chieng', 'chiet', 'chim', 'chin', 'chinh', 'chip', 'chit', 'chiu',
  'cho', 'choc', 'choi', 'chom', 'chon', 'chong', 'chop', 'chot',
  'chu', 'chua', 'chuc', 'chue', 'chui', 'chum', 'chun', 'chung', 'chup', 'chut', 'chuy', 'chuyen', 'chuyet',
  'da', 'dac', 'dach', 'dai', 'dam', 'dan', 'dang', 'danh', 'dao', 'dap', 'dat', 'day',
  'de', 'dec', 'dech', 'dem', 'den', 'deng', 'deo', 'dep', 'det',
  'di', 'dia', 'dich', 'diem', 'dien', 'dieng', 'diet', 'dim', 'din', 'dinh', 'dip', 'dit', 'diu',
  'do', 'doc', 'doi', 'dom', 'don', 'dong', 'dop', 'dot',
  'du', 'dua', 'duc', 'due', 'dui', 'dum', 'dun', 'dung', 'dup', 'dut', 'duy', 'duyen', 'duyet',
  'đa', 'đac', 'đach', 'đai', 'đam', 'đan', 'đang', 'đanh', 'đao', 'đap', 'đat', 'đay',
  'đe', 'đec', 'đech', 'đem', 'đen', 'đeng', 'đeo', 'đep', 'đet',
  'đi', 'đia', 'đich', 'điem', 'đien', 'đieng', 'điet', 'đim', 'đin', 'đinh', 'đip', 'đit', 'điu',
  'đo', 'đoc', 'đoi', 'đom', 'đon', 'đong', 'đop', 'đot',
  'đu', 'đua', 'đuc', 'đue', 'đui', 'đum', 'đun', 'đung', 'đup', 'đut', 'đuy', 'đuyen', 'đuyet',
  'e', 'ec', 'ech', 'em', 'en', 'eng', 'eo', 'ep', 'et',
  'ga', 'gac', 'gach', 'gai', 'gam', 'gan', 'gang', 'ganh', 'gao', 'gap', 'gat', 'gay',
  'ge', 'gec', 'gem', 'gen', 'geng', 'geo', 'get',
  'ghe', 'ghec', 'ghen', 'gheng', 'gheo', 'ghep', 'ghet',
  'ghi', 'ghia', 'ghich', 'ghiem', 'ghien', 'ghiet', 'ghim', 'ghin', 'ghinh', 'ghip', 'ghit',
  'gi', 'gia', 'giac', 'giach', 'giai', 'giam', 'gian', 'giang', 'gianh', 'giao', 'giap', 'giat', 'giay',
  'gie', 'giec', 'giem', 'gien', 'gieng', 'gieo', 'giep', 'giet',
  'gim', 'gin', 'gio', 'gioc', 'gioi', 'giom', 'gion', 'giong', 'giop', 'giot',
  'giu', 'giua', 'giuc', 'giui', 'gium', 'giun', 'giung', 'giup', 'giut',
  'go', 'goc', 'goi', 'gom', 'gon', 'gong', 'gop', 'got',
  'gu', 'gua', 'guc', 'gui', 'gum', 'gun', 'gung', 'gup', 'gut',
  'ha', 'hac', 'hach', 'hai', 'ham', 'han', 'hang', 'hanh', 'hao', 'hap', 'hat', 'hay',
  'he', 'hec', 'hech', 'hem', 'hen', 'heng', 'heo', 'hep', 'het',
  'hi', 'hia', 'hich', 'hiem', 'hien', 'hieng', 'hiet', 'him', 'hin', 'hinh', 'hip', 'hit', 'hiu',
  'ho', 'hoc', 'hoi', 'hom', 'hon', 'hong', 'hop', 'hot',
  'hu', 'hua', 'huc', 'hue', 'hui', 'hum', 'hun', 'hung', 'hup', 'hut', 'huy', 'huyen', 'huyet', 'huynh', 'huych',
  'i', 'ia', 'ich', 'iem', 'ien', 'ieng', 'iet', 'im', 'in', 'inh', 'ip', 'it', 'iu',
  'ka', 'kac', 'kai', 'kam', 'kan', 'kang', 'kao', 'kap', 'kat', 'kay',
  'ke', 'kec', 'kech', 'kem', 'ken', 'keng', 'keo', 'kep', 'ket',
  'kha', 'khac', 'khach', 'khai', 'kham', 'khan', 'khang', 'khanh', 'khao', 'khap', 'khat', 'khay',
  'khe', 'khec', 'khech', 'khem', 'khen', 'kheng', 'kheo', 'khep', 'khet',
  'khi', 'khia', 'khich', 'khiem', 'khien', 'khieng', 'khiet', 'khim', 'khin', 'khinh', 'khip', 'khit', 'khiu',
  'kho', 'khoc', 'khoi', 'khom', 'khon', 'khong', 'khop', 'khot',
  'khu', 'khua', 'khuc', 'khue', 'khui', 'khum', 'khun', 'khung', 'khup', 'khut', 'khuy', 'khuyen', 'khuyet',
  'ki', 'kia', 'kich', 'kiem', 'kien', 'kieng', 'kiet', 'kim', 'kin', 'kinh', 'kip', 'kit', 'kiu',
  'la', 'lac', 'lach', 'lai', 'lam', 'lan', 'lang', 'lanh', 'lao', 'lap', 'lat', 'lay',
  'le', 'lec', 'lech', 'lem', 'len', 'leng', 'leo', 'lep', 'let',
  'li', 'lia', 'lich', 'liem', 'lien', 'lieng', 'liet', 'lim', 'lin', 'linh', 'lip', 'lit', 'liu',
  'lo', 'loc', 'loi', 'lom', 'lon', 'long', 'lop', 'lot',
  'lu', 'lua', 'luc', 'lue', 'lui', 'lum', 'lun', 'lung', 'lup', 'lut', 'luy', 'luyen', 'luyet',
  'ma', 'mac', 'mach', 'mai', 'mam', 'man', 'mang', 'manh', 'mao', 'map', 'mat', 'may',
  'me', 'mec', 'mech', 'mem', 'men', 'meng', 'meo', 'mep', 'met',
  'mi', 'mia', 'mich', 'miem', 'mien', 'mieng', 'miet', 'mim', 'min', 'minh', 'mip', 'mit', 'miu',
  'mo', 'moc', 'moi', 'mom', 'mon', 'mong', 'mop', 'mot',
  'mu', 'mua', 'muc', 'mue', 'mui', 'mum', 'mun', 'mung', 'mup', 'mut',
  'na', 'nac', 'nach', 'nai', 'nam', 'nan', 'nang', 'nanh', 'nao', 'nap', 'nat', 'nay',
  'ne', 'nec', 'nech', 'nem', 'nen', 'neng', 'neo', 'nep', 'net',
  'ng', 'nga', 'ngac', 'ngach', 'ngai', 'ngam', 'ngan', 'ngang', 'nganh', 'ngao', 'ngap', 'ngat', 'ngay',
  'nge', 'ngec', 'ngem', 'ngen', 'ngeo', 'nget',
  'nghe', 'nghec', 'nghech', 'nghem', 'nghen', 'ngheng', 'ngheo', 'nghep', 'nghet',
  'nghi', 'nghia', 'nghich', 'nghiem', 'nghien', 'nghieng', 'nghiet', 'nghim', 'nghin', 'nghinh', 'nghip', 'nghit', 'nghiu',
  'ngo', 'ngoc', 'ngoi', 'ngom', 'ngon', 'ngong', 'ngop', 'ngot',
  'ngu', 'ngua', 'nguc', 'ngue', 'ngui', 'ngum', 'ngun', 'ngung', 'ngup', 'ngut', 'nguy', 'nguyen', 'nguyet',
  'nha', 'nhac', 'nhach', 'nhai', 'nham', 'nhan', 'nhang', 'nhanh', 'nhao', 'nhap', 'nhat', 'nhay',
  'nhe', 'nhec', 'nhech', 'nhem', 'nhen', 'nheng', 'nheo', 'nhep', 'nhet',
  'nhi', 'nhia', 'nhich', 'nhiem', 'nhien', 'nhieng', 'nhiet', 'nhim', 'nhin', 'nhinh', 'nhip', 'nhit', 'nhiu',
  'nho', 'nhoc', 'nhoi', 'nhom', 'nhon', 'nhong', 'nhop', 'nhot',
  'nhu', 'nhua', 'nhuc', 'nhue', 'nhui', 'nhum', 'nhun', 'nhung', 'nhup', 'nhut', 'nhuy', 'nhuyen', 'nhuyet',
  'ni', 'nia', 'nich', 'niem', 'nien', 'nieng', 'niet', 'nim', 'nin', 'ninh', 'nip', 'nit', 'niu',
  'no', 'noc', 'noi', 'nom', 'non', 'nong', 'nop', 'not',
  'nu', 'nua', 'nuc', 'nue', 'nui', 'num', 'nun', 'nung', 'nup', 'nut',
  'o', 'oa', 'oac', 'oach', 'oai', 'oam', 'oan', 'oang', 'oanh', 'oap', 'oat', 'oay',
  'oc', 'oe', 'oen', 'oeo', 'oet', 'oi', 'om', 'on', 'ong', 'op', 'ot',
  'pa', 'pac', 'pan', 'pang', 'pao', 'pap', 'pat', 'pay',
  'pe', 'pec', 'pen', 'peng', 'peo', 'pet',
  'pha', 'phac', 'phach', 'phai', 'pham', 'phan', 'phang', 'phanh', 'phao', 'phap', 'phat', 'phay',
  'phe', 'phec', 'phech', 'phem', 'phen', 'pheng', 'pheo', 'phep', 'phet',
  'phi', 'phia', 'phich', 'phiem', 'phien', 'phieng', 'phiet', 'phim', 'phin', 'phinh', 'phip', 'phit', 'phiu',
  'pho', 'phoc', 'phoi', 'phom', 'phon', 'phong', 'phop', 'phot',
  'phu', 'phua', 'phuc', 'phue', 'phui', 'phum', 'phun', 'phung', 'phup', 'phut', 'phuy', 'phuyen', 'phuyet',
  'pi', 'pic', 'pim', 'pin', 'ping', 'pip', 'pit',
  'po', 'poc', 'poi', 'pom', 'pon', 'pong', 'pop', 'pot',
  'pu', 'puc', 'pui', 'pum', 'pun', 'pung', 'pup', 'put',
  'qua', 'quac', 'quach', 'quai', 'quam', 'quan', 'quang', 'quanh', 'quao', 'quap', 'quat', 'quay',
  'que', 'quec', 'quech', 'quem', 'quen', 'queng', 'queo', 'quep', 'quet',
  'qui', 'quia', 'quich', 'quiem', 'quien', 'quieng', 'quiet', 'quim', 'quin', 'quinh', 'quip', 'quit', 'quiu',
  'quo', 'quoc', 'quon', 'quong',
  'quy', 'quya', 'quych', 'quyem', 'quyen', 'quyeng', 'quyet', 'quym', 'quyn', 'quynh', 'quyp', 'quyt', 'quyu',
  'ra', 'rac', 'rach', 'rai', 'ram', 'ran', 'rang', 'ranh', 'rao', 'rap', 'rat', 'ray',
  're', 'rec', 'rech', 'rem', 'ren', 'reng', 'reo', 'rep', 'ret',
  'ri', 'ria', 'rich', 'riem', 'rien', 'rieng', 'riet', 'rim', 'rin', 'rinh', 'rip', 'rit', 'riu',
  'ro', 'roc', 'roi', 'rom', 'ron', 'rong', 'rop', 'rot',
  'ru', 'rua', 'ruc', 'rue', 'rui', 'rum', 'run', 'rung', 'rup', 'rut', 'ruy', 'ruyen', 'ruyet',
  'sa', 'sac', 'sach', 'sai', 'sam', 'san', 'sang', 'sanh', 'sao', 'sap', 'sat', 'say',
  'se', 'sec', 'sech', 'sem', 'sen', 'seng', 'seo', 'sep', 'set',
  'si', 'sia', 'sich', 'siem', 'sien', 'sieng', 'siet', 'sim', 'sin', 'sinh', 'sip', 'sit', 'siu',
  'so', 'soc', 'soi', 'som', 'son', 'song', 'sop', 'sot',
  'su', 'sua', 'suc', 'sue', 'sui', 'sum', 'sun', 'sung', 'sup', 'sut', 'suy', 'suyen', 'suyet',
  'ta', 'tac', 'tach', 'tai', 'tam', 'tan', 'tang', 'tanh', 'tao', 'tap', 'tat', 'tay',
  'te', 'tec', 'tech', 'tem', 'ten', 'teng', 'teo', 'tep', 'tet',
  'tha', 'thac', 'thach', 'thai', 'tham', 'than', 'thang', 'thanh', 'thao', 'thap', 'that', 'thay',
  'the', 'thec', 'thech', 'them', 'then', 'theng', 'theo', 'thep', 'thet',
  'thi', 'thia', 'thich', 'thiem', 'thien', 'thieng', 'thiet', 'thim', 'thin', 'thinh', 'thip', 'thit', 'thiu',
  'tho', 'thoc', 'thoi', 'thom', 'thon', 'thong', 'thop', 'thot',
  'thu', 'thua', 'thuc', 'thue', 'thui', 'thum', 'thun', 'thung', 'thup', 'thut', 'thuy', 'thuyen', 'thuyet',
  'ti', 'tia', 'tich', 'tiem', 'tien', 'tieng', 'tiet', 'tim', 'tin', 'tinh', 'tip', 'tit', 'tiu',
  'to', 'toc', 'toi', 'tom', 'ton', 'tong', 'top', 'tot',
  'tra', 'trac', 'trach', 'trai', 'tram', 'tran', 'trang', 'tranh', 'trao', 'trap', 'trat', 'tray',
  'tre', 'trec', 'trech', 'trem', 'tren', 'treng', 'treo', 'trep', 'tret',
  'tri', 'tria', 'trich', 'triem', 'trien', 'trieng', 'triet', 'trim', 'trin', 'trinh', 'trip', 'trit', 'triu',
  'tro', 'troc', 'troi', 'trom', 'tron', 'trong', 'trop', 'trot',
  'tru', 'trua', 'truc', 'true', 'trui', 'trum', 'trun', 'trung', 'trup', 'trut', 'truy', 'truyen', 'truyet',
  'tu', 'tua', 'tuc', 'tue', 'tui', 'tum', 'tun', 'tung', 'tup', 'tut', 'tuy', 'tuyen', 'tuyet',
  'u', 'ua', 'uac', 'uam', 'uan', 'uang', 'uap', 'uat', 'uay',
  'uc', 'ue', 'uen', 'uet', 'ui', 'um', 'un', 'ung', 'uo', 'uoc', 'uoi', 'uom', 'uon', 'uong', 'uop', 'uot', 'uou',
  'up', 'ut', 'uy', 'uya', 'uyen', 'uyet', 'uyn', 'uynh', 'uyp', 'uyt',
  'va', 'vac', 'vach', 'vai', 'vam', 'van', 'vang', 'vanh', 'vao', 'vap', 'vat', 'vay',
  've', 'vec', 'vech', 'vem', 'ven', 'veng', 'veo', 'vep', 'vet',
  'vi', 'via', 'vich', 'viem', 'vien', 'vieng', 'viet', 'vim', 'vin', 'vinh', 'vip', 'vit', 'viu',
  'vo', 'voc', 'voi', 'vom', 'von', 'vong', 'vop', 'vot',
  'vu', 'vua', 'vuc', 'vue', 'vui', 'vum', 'vun', 'vung', 'vup', 'vut', 'vuy', 'vuyen', 'vuyet',
  'xa', 'xac', 'xach', 'xai', 'xam', 'xan', 'xang', 'xanh', 'xao', 'xap', 'xat', 'xay',
  'xe', 'xec', 'xech', 'xem', 'xen', 'xeng', 'xeo', 'xep', 'xet',
  'xi', 'xia', 'xich', 'xiem', 'xien', 'xieng', 'xiet', 'xim', 'xin', 'xinh', 'xip', 'xit', 'xiu',
  'xo', 'xoc', 'xoi', 'xom', 'xon', 'xong', 'xop', 'xot',
  'xu', 'xua', 'xuc', 'xue', 'xui', 'xum', 'xun', 'xung', 'xup', 'xut', 'xuy', 'xuyen', 'xuyet',
  'y', 'ya', 'ye', 'yem', 'yen', 'yeng', 'yeo', 'yet', 'ym', 'yn', 'ynh', 'yp', 'yt', 'yu'
];

/**
 * Diacritics tone mappings for all Vietnamese vowels
 */
const VOWEL_ACCENTS: Record<string, string[]> = {
  'a': ['a', 'à', 'á', 'ả', 'ã', 'ạ'],
  'ă': ['ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ'],
  'â': ['â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ'],
  'e': ['e', 'è', 'é', 'ẻ', 'ẽ', 'ẹ'],
  'ê': ['ê', 'ề', 'ế', 'ể', 'ễ', 'ệ'],
  'i': ['i', 'ì', 'í', 'ỉ', 'ĩ', 'ị'],
  'o': ['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ'],
  'ô': ['ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ'],
  'ơ': ['ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ'],
  'u': ['u', 'ù', 'ú', 'ủ', 'ũ', 'ụ'],
  'ư': ['ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự'],
  'y': ['y', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ'],
};

// Generate standard lexicon of accented syllables
const VIETNAMESE_SYLLABLE_SET = new Set<string>();

// Pre-populate with common words and all diacritics
function initSyllableSet(): void {
  // Add base syllables
  for (const s of BASE_SYLLABLES) {
    VIETNAMESE_SYLLABLE_SET.add(s.normalize('NFC'));
  }

  // Populate accented combinations for common Vietnamese nuclei
  const vowels = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y'];
  for (const v of vowels) {
    for (const accented of VOWEL_ACCENTS[v] || []) {
      VIETNAMESE_SYLLABLE_SET.add(accented.normalize('NFC'));
    }
  }

  // Generate inflected forms for consonants + vowels + finals
  const onsets = ['', 'b', 'c', 'ch', 'd', 'đ', 'g', 'gh', 'gi', 'h', 'k', 'kh', 'l', 'm', 'n', 'ng', 'ngh', 'nh', 'p', 'ph', 'qu', 'r', 's', 't', 'th', 'tr', 'v', 'x'];
  const codas = ['', 'c', 'ch', 'm', 'n', 'ng', 'nh', 'p', 't', 'i', 'u', 'y', 'o'];
  
  // Diphthongs / Triphthongs / Nuclei
  const nucleusMap: Record<string, string[][]> = {
    'a': [['a', 'à', 'á', 'ả', 'ã', 'ạ']],
    'ă': [['ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ']],
    'â': [['â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ']],
    'e': [['e', 'è', 'é', 'ẻ', 'ẽ', 'ẹ']],
    'ê': [['ê', 'ề', 'ế', 'ể', 'ễ', 'ệ']],
    'i': [['i', 'ì', 'í', 'ỉ', 'ĩ', 'ị']],
    'o': [['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ']],
    'ô': [['ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ']],
    'ơ': [['ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ']],
    'u': [['u', 'ù', 'ú', 'ủ', 'ũ', 'ụ']],
    'ư': [['ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự']],
    'y': [['y', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ']],
    'ia': [['ia', 'ìa', 'ía', 'ỉa', 'ĩa', 'ịa']],
    'iê': [['iê', 'iề', 'iế', 'iể', 'iễ', 'iệ']],
    'ua': [['ua', 'ùa', 'úa', 'ủa', 'ũa', 'ụa']],
    'uô': [['uô', 'uồ', 'uố', 'uổ', 'uỗ', 'uộ']],
    'ưa': [['ưa', 'ừa', 'ứa', 'ửa', 'ữa', 'ựa']],
    'ươ': [['ươ', 'ườ', 'ướ', 'ưở', 'ưỡng', 'ượ', 'ưỡ']],
    'oa': [['oa', 'oà', 'oá', 'oả', 'oã', 'oạ', 'òa', 'óa', 'ỏa', 'õa', 'ọa']],
    'oă': [['oă', 'oằ', 'oắ', 'oẳ', 'oẵ', 'oặ', 'oằ', 'oắ', 'oẳ', 'oẵ', 'oặ']],
    'oe': [['oe', 'oè', 'oé', 'oẻ', 'oẽ', 'oẹ', 'òe', 'óe', 'ỏe', 'õe', 'ọe']],
    'uâ': [['uâ', 'uầ', 'uấ', 'uẩ', 'uẫ', 'uậ']],
    'uê': [['uê', 'uề', 'uế', 'uể', 'uễ', 'uệ', 'ùe', 'úe', 'ủe', 'ũe', 'ụe']],
    'uy': [['uy', 'uỳ', 'uý', 'uỷ', 'uỹ', 'uỵ', 'ùy', 'úy', 'ủy', 'ũy', 'ụy']],
    'uơ': [['uơ', 'uờ', 'uớ', 'uở', 'uỡ', 'uợ']],
    'uyê': [['uyê', 'uyề', 'uyế', 'uyể', 'uyễ', 'uyệ']],
    'uya': [['uya', 'uỳa', 'uýa', 'uỷa', 'uỹa', 'uỵa']],
    'iêu': [['iêu', 'iều', 'iếu', 'iểu', 'iễu', 'iệu']],
    'yêu': [['yêu', 'yều', 'yếu', 'yểu', 'yễu', 'yệu']],
    'oai': [['oai', 'oài', 'oái', 'oải', 'oãi', 'oại', 'òai', 'óai', 'ỏai', 'õai', 'ọai']],
    'oay': [['oay', 'oày', 'oáy', 'oảy', 'oãy', 'oạy']],
    'uay': [['uay', 'uày', 'uáy', 'uảy', 'uãy', 'uạy']],
    'ươi': [['ươi', 'ười', 'ưới', 'ưởi', 'ưỡi', 'ượi']],
    'ươu': [['ươu', 'ườu', 'ướu', 'ưởu', 'ưỡu', 'ượu']],
  };

  for (const onset of onsets) {
    for (const [_, toneLists] of Object.entries(nucleusMap)) {
      for (const toneVariants of toneLists) {
        for (const nuc of toneVariants) {
          for (const coda of codas) {
            // Phonotactic filter rules
            if (onset === 'k' && !/^[ieêy]/.test(nuc)) continue;
            if (onset === 'c' && /^[ieêy]/.test(nuc)) continue;
            if (onset === 'gh' && !/^[ieê]/.test(nuc)) continue;
            if (onset === 'g' && /^[ieê]/.test(nuc)) continue;
            if (onset === 'ngh' && !/^[ieê]/.test(nuc)) continue;
            if (onset === 'ng' && /^[ieê]/.test(nuc)) continue;
            if (onset === 'qu' && /^[uư]/.test(nuc)) continue;

            const syl = (onset + nuc + coda).normalize('NFC');
            VIETNAMESE_SYLLABLE_SET.add(syl);
          }
        }
      }
    }
  }

  // Add historical terms & Sino-Vietnamese roots
  const historicalSyllables = [
    'vương', 'nguyễn', 'trần', 'lê', 'lý', 'đinh', 'ngô', 'hồ', 'mạc', 'trịnh', 'quang', 'trung',
    'huệ', 'nhạc', 'lữ', 'hoàng', 'đế', 'thái', 'tổ', 'tông', 'anh', 'hùng', 'tướng', 'quân',
    'bạch', 'đằng', 'thăng', 'long', 'hoa', 'lư', 'đại', 'việt', 'nam', 'bắc', 'đông', 'tây',
    'quốc', 'sử', 'cương', 'mục', 'toàn', 'thư', 'thực', 'lục', 'bình', 'ngô', 'cáo', 'hịch',
    'chiếu', 'dời', 'đô', 'ngọc', 'hồi', 'đống', 'đa', 'chi', 'lăng', 'xương', 'giang', 'hàm',
    'tử', 'chương', 'dương', 'vạn', 'kiếp', 'phú', 'xuân', 'thuận', 'hóa', 'gia', 'định',
    'tân', 'sửu', 'kỷ', 'sửu', 'quý', 'hợi', 'ất', 'dậu', 'giáp', 'thìn', 'mậu', 'tuất',
    'trước', 'người', 'nước', 'được', 'đều', 'điều', 'đến', 'đặng', 'viên', 'bảo', 'ả', 'đào'
  ];

  for (const s of historicalSyllables) {
    VIETNAMESE_SYLLABLE_SET.add(s.normalize('NFC'));
  }
}

initSyllableSet();

/**
 * Checks if a token is a phonetically valid Vietnamese syllable
 */
export function isValidSyllable(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const norm = token.trim().toLowerCase().normalize('NFC');
  return VIETNAMESE_SYLLABLE_SET.has(norm);
}

/**
 * Checks if a token is a protected standalone single-letter word
 */
export function isStandaloneSingleLetterWord(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const norm = token.trim().toLowerCase().normalize('NFC');
  return STANDALONE_SINGLE_LETTER_WORDS.has(norm);
}

/**
 * Checks if a token is a non-standalone OCR fragment
 */
export function isNonStandaloneFragment(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const norm = token.trim().toLowerCase().normalize('NFC');
  return NON_STANDALONE_FRAGMENTS.has(norm);
}
