import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────
// 상수 데이터
// ─────────────────────────────────────────────
const DEFAULT_PASSWORD = "zeroclip2026";
const getPassword = () => localStorage.getItem("zc_password") || DEFAULT_PASSWORD;

const DEFAULT_TAXONOMY = {
  "전체":          { emoji:"🎯", color:"#374151", subs:[] },
  "드라마/영화":   { emoji:"🎬", color:"#E74C3C", subs:["전체","국내드라마","해외드라마","영화리뷰","명장면"] },
  "애니메이션":    { emoji:"🌀", color:"#9B59B6", subs:["전체","일본애니","미국애니","웹툰원작"] },
  "지식/교육":     { emoji:"📚", color:"#2980B9", subs:["전체","역사","과학","심리","경제","상식"] },
  "국뽕/해외반응": { emoji:"🇰🇷", color:"#27AE60", subs:["전체","해외반응","국뽕","한국문화"] },
  "감동/스토리":   { emoji:"❤️", color:"#FF6B9D", subs:["전체","감동","사연","브이로그"] },
  "음악":          { emoji:"🎵", color:"#E91E63", subs:["전체","커버","뮤직비디오","아이돌"] },
  "코미디/밈":     { emoji:"😂", color:"#FFC107", subs:["전체","개그","상황극","밈"] },
  "스포츠":        { emoji:"⚽", color:"#4CAF50", subs:["전체","축구","야구","농구","격투기"] },
  "게임":          { emoji:"🎮", color:"#3F51B5", subs:["전체","FPS","RPG","모바일"] },
  "쇼핑/리뷰":    { emoji:"🛍️", color:"#FF9800", subs:["전체","제품리뷰","언박싱","맛집"] },
  "뉴스/정치":     { emoji:"📰", color:"#607D8B", subs:["전체","국내정치","해외이슈","사회"] },
};

let TAXONOMY = (() => {
  try { return JSON.parse(localStorage.getItem("zc_taxonomy")||"null") || DEFAULT_TAXONOMY; } catch { return {...DEFAULT_TAXONOMY}; }
})();

const CAT_COLORS = ["#E74C3C","#9B59B6","#2980B9","#27AE60","#FF6B9D","#E91E63","#FFC107","#4CAF50","#3F51B5","#FF9800","#607D8B","#00BCD4","#795548","#8BC34A","#F39C12"];


const PERIOD_OPTIONS = [
  { label:"전체 기간", value:"all" },
  { label:"오늘",      value:"today" },
  { label:"이번 주",   value:"week" },
  { label:"이번 달",   value:"month" },
  { label:"올해",      value:"year" },
  { label:"직접 입력", value:"custom" },
];
const SORT_OPTIONS = [
  { label:"배수 순",     value:"multiplier" },
  { label:"조회수 순",   value:"views" },
  { label:"업로드 순",   value:"date" },
  { label:"최신 등록순", value:"added" },
];

const DEFAULT_TAGS = ["🔥급하게쓸것","📦장기보관","✅이미했음","❌경쟁채널있음","💡아이디어메모","⭐베스트레퍼"];

const daysMap = {"오늘":0,"3일 전":3,"1주일 전":7,"2주일 전":14,"1개월 전":30,"2개월 전":60,"3개월 전":90,"4개월 전":120,"5개월 전":150,"6개월 전":180,"8개월 전":240,"10개월 전":300,"11개월 전":330,"1년 전":365,"2년 전":730};

// publishedAt 있으면 정확한 날짜로, 없으면 daysAgo 텍스트로 계산
const getCardDays = (card) => {
  if (card.publishedAt) return Math.floor((Date.now()-new Date(card.publishedAt))/86400000);
  return daysMap[card.daysAgo]??999;
};

const calcDaysAgoText = (publishedAt) => {
  const d = Math.floor((Date.now()-new Date(publishedAt))/86400000);
  if (d===0) return "오늘";
  if (d===1) return "1일 전";
  if (d<=6)  return `${d}일 전`;
  if (d<=13) return "1주일 전";
  if (d<=20) return "2주일 전";
  if (d<=45) return "1개월 전";
  if (d<=75) return "2개월 전";
  if (d<=105) return "3개월 전";
  if (d<=210) return "6개월 전";
  if (d<=395) return "1년 전";
  return "2년 전";
};

// 표시용 날짜 - publishedAt 있으면 실시간 계산, 없으면 저장된 텍스트
const getDisplayDate = (card) => {
  if (card?.publishedAt) return calcDaysAgoText(card.publishedAt);
  return card?.daysAgo || "";
};

const isInPeriod = (card, period, from, to) => {
  if (period==="all") return true;
  // publishedAt 없는 카드는 기간 필터에서 제외 (stale daysAgo 텍스트로 오인 방지)
  if (!card.publishedAt) return false;
  const d = getCardDays(card);
  if (period==="today") return d===0;
  if (period==="week")  return d<=7;
  if (period==="month") return d<=30;
  if (period==="year")  return d<=365;
  if (period==="custom") {
    if (!from&&!to) return true;
    const pub = new Date(card.publishedAt);
    const fromTs = from ? new Date(from).getTime() : 0;
    const toTs   = to   ? new Date(to+"T23:59:59").getTime() : Date.now();
    return pub.getTime()>=fromTs && pub.getTime()<=toTs;
  }
  return true;
};

const toViewsNum = v => {
  if (!v) return 0;
  if (v.includes("천만")) return parseFloat(v)*10000000;
  if (v.includes("백만")) return parseFloat(v)*1000000;
  if (v.includes("만"))   return parseFloat(v)*10000;
  if (v.includes("천"))   return parseFloat(v)*1000;
  return parseFloat(v)||0;
};

const INIT_DATA = [];

// ─────────────────────────────────────────────
// 유틸 훅
// ─────────────────────────────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return ()=>document.removeEventListener("mousedown", h);
  }, []);
  return { open, setOpen, ref };
}

// ─────────────────────────────────────────────
// 비밀번호 화면
// ─────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (pw === getPassword()) { onLogin(); }
    else { setErr(true); setTimeout(()=>setErr(false),1500); }
  };
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl" style={{background:"#FF8C00"}}>
            🍊
          </div>
          <div className="leading-none">
            <span className="text-2xl font-black text-white tracking-tight">귤</span>
            <span className="text-2xl font-black tracking-tight" style={{color:"#FF8C00"}}>박스</span>
          </div>
        </div>
        <p className="text-center text-gray-400 text-sm mb-6">귤쌤의 쇼츠 소재 리서치 툴</p>
        <div className={`bg-gray-900 rounded-3xl p-6 transition-all ${err?"ring-2 ring-red-500":""}`}>
          <label className="text-xs font-bold text-gray-400 block mb-2">비밀번호</label>
          <input
            type="password" value={pw} onChange={e=>setPw(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="비밀번호를 입력하세요"
            className="w-full bg-gray-800 text-white text-sm rounded-2xl px-4 py-3 outline-none border-2 border-transparent focus:border-orange-400 mb-3 placeholder-gray-600"
          />
          {err && <p className="text-red-400 text-xs mb-3 font-bold text-center">❌ 비밀번호가 틀렸어요</p>}
          <button onClick={submit} className="w-full py-3 rounded-2xl text-sm font-black text-gray-900" style={{background:"#FF8C00"}}>
            입장하기
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 필터 컴포넌트들
// ─────────────────────────────────────────────
const PeriodFilter = ({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }) => {
  const { open, setOpen, ref } = useDropdown();
  const label = period==="custom"
    ? (customFrom||customTo?`${customFrom||"~"}~${customTo||"~"}`:"직접 입력")
    : PERIOD_OPTIONS.find(o=>o.value===period)?.label;
  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 whitespace-nowrap">
        📅 {label}
        <svg className={`w-3 h-3 transition-transform ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&(
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 w-60 overflow-hidden">
          <div className="p-1">
            {PERIOD_OPTIONS.map(opt=>(
              <button key={opt.value} onClick={()=>{setPeriod(opt.value);if(opt.value!=="custom")setOpen(false);}}
                className={`w-full text-left text-sm px-3 py-2 rounded-xl font-medium transition-colors ${period===opt.value?"bg-gray-900 text-white":"text-gray-700 hover:bg-gray-100"}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {period==="custom"&&(
            <div className="border-t border-gray-100 p-3 space-y-2">
              <div><label className="text-xs text-gray-400 block mb-1">시작일</label>
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none"/></div>
              <div><label className="text-xs text-gray-400 block mb-1">종료일</label>
                <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none"/></div>
              <button onClick={()=>setOpen(false)} className="w-full text-white text-xs font-bold py-2 rounded-xl" style={{background:"#FF8C00",color:"#111"}}>적용</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SortFilter = ({ sortBy, setSortBy, sortDir, setSortDir }) => {
  const { open, setOpen, ref } = useDropdown();
  const label = SORT_OPTIONS.find(o=>o.value===sortBy)?.label;
  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 whitespace-nowrap">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
        {label} {sortDir==="desc"?"↓":"↑"}
        <svg className={`w-3 h-3 transition-transform ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&(
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 w-44 overflow-hidden">
          <div className="p-2">
            <p className="text-xs font-bold text-gray-400 px-2 pb-1">정렬 기준</p>
            {SORT_OPTIONS.map(opt=>(
              <button key={opt.value} onClick={()=>setSortBy(opt.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-xl font-medium flex justify-between ${sortBy===opt.value?"bg-gray-900 text-white":"text-gray-700 hover:bg-gray-100"}`}>
                {opt.label}{sortBy===opt.value&&<span className="opacity-60">✓</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 p-2">
            <p className="text-xs font-bold text-gray-400 px-2 pb-1">방향</p>
            {[{label:"↓ 내림차순",value:"desc"},{label:"↑ 오름차순",value:"asc"}].map(opt=>(
              <button key={opt.value} onClick={()=>{setSortDir(opt.value);setOpen(false);}}
                className={`w-full text-left text-sm px-3 py-2 rounded-xl font-medium ${sortDir===opt.value?"bg-gray-900 text-white":"text-gray-700 hover:bg-gray-100"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 카테고리 드롭다운
// ─────────────────────────────────────────────
const CategoryDropdown = ({ mainCat, onSelect, cards }) => {
  const { open, setOpen, ref } = useDropdown();
  const cur = TAXONOMY[mainCat];
  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-1.5 text-xs font-bold border-2 rounded-xl px-3 py-1.5 whitespace-nowrap transition-all"
        style={mainCat!=="전체"?{borderColor:cur?.color,backgroundColor:cur?.color+"15",color:cur?.color}:{borderColor:"#e5e7eb",backgroundColor:"white",color:"#374151"}}>
        <span>{cur?.emoji}</span>{mainCat}
        <span className="opacity-50 text-xs">{mainCat==="전체"?cards.length:cards.filter(c=>c.mainCat===mainCat).length}</span>
        <svg className={`w-3 h-3 transition-transform ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&(
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 w-52 overflow-hidden">
          <div className="p-1.5 max-h-72 overflow-y-auto">
            {Object.entries(TAXONOMY).map(([cat,{emoji,color:c}])=>{
              const count = cat==="전체"?cards.length:cards.filter(i=>i.mainCat===cat).length;
              const isActive = mainCat===cat;
              return (
                <button key={cat} onClick={()=>{onSelect(cat);setOpen(false);}}
                  className="w-full text-left flex items-center gap-2 text-sm px-3 py-2 rounded-xl font-medium transition-colors"
                  style={isActive?{backgroundColor:c,color:"white"}:{color:"#374151"}}>
                  <span>{emoji}</span>
                  <span className="flex-1">{cat}</span>
                  <span className="opacity-50 text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SubCatDropdown = ({ mainCat, subCat, onSelect, cards, color }) => {
  const { open, setOpen, ref } = useDropdown();
  const subs = TAXONOMY[mainCat]?.subs||[];
  if (subs.length===0) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-1.5 text-xs font-bold border rounded-xl px-3 py-1.5 whitespace-nowrap transition-all"
        style={subCat&&subCat!=="전체"?{borderColor:color,backgroundColor:color+"15",color}:{borderColor:"#e5e7eb",backgroundColor:"white",color:"#374151"}}>
        {subCat||"소분류"}
        <svg className={`w-3 h-3 transition-transform ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&(
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 w-44 overflow-hidden">
          <div className="p-1.5">
            {subs.map(sub=>{
              const count = sub==="전체"?cards.filter(c=>c.mainCat===mainCat).length:cards.filter(c=>c.mainCat===mainCat&&c.subCat===sub).length;
              return (
                <button key={sub} onClick={()=>{onSelect(sub);setOpen(false);}}
                  className="w-full text-left flex items-center justify-between text-sm px-3 py-2 rounded-xl font-medium transition-colors"
                  style={(subCat||"전체")===sub?{backgroundColor:color,color:"white"}:{color:"#374151"}}>
                  <span>{sub}</span><span className="opacity-50 text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 태그 필터 드롭다운
// ─────────────────────────────────────────────
const TagFilter = ({ allTags, activeTag, setActiveTag }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button onClick={()=>setOpen(o=>!o)}
        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all ${activeTag?"border-gray-900 bg-gray-900 text-white":"border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
        {activeTag ? activeTag : "태그"}
        {activeTag&&<button onClick={e=>{e.stopPropagation();setActiveTag("");}} className="ml-0.5 text-gray-400 hover:text-white">✕</button>}
        <svg className={`w-3 h-3 transition-transform ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&(
        <div className="flex flex-wrap gap-1.5">
          <button onClick={()=>{setActiveTag("");setOpen(false);}}
            className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all ${!activeTag?"bg-gray-900 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            전체
          </button>
          {allTags.map(tag=>(
            <button key={tag} onClick={()=>{setActiveTag(activeTag===tag?"":tag);setOpen(false);}}
              className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all ${activeTag===tag?"bg-gray-900 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 카드 추가 모달
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 대본 모달
// ─────────────────────────────────────────────
const ScriptModal = ({ item, onClose, onSave, geminiKey }) => {
  const [text, setText]       = useState(item.script||"");
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mode, setMode]       = useState("transcript"); // transcript | analyze

  const copy = ()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1500);};

  const runGemini = async (selectedMode) => {
    if (!openAiKey||!openAiKey.startsWith("sk-")) { setError("⚙️ 설정에서 ChatGPT API 키를 먼저 등록해주세요"); return; }
    if (!item.url) { setError("영상 URL이 없어요"); return; }
    setLoading(true); setError(""); setMode(selectedMode);
    try {
      const prompts = {
        transcript: "이 유튜브 영상의 나레이션/대본을 한국어로 추출해줘. 실제로 말하는 내용만, 타임스탬프 없이 대본 텍스트만 출력해줘.",
        hook: "이 유튜브 쇼츠 영상의 첫 3초 훅 구조를 분석해줘. 어떤 방식으로 시청자를 잡아끄는지, 핵심 패턴이 뭔지 알려줘.",
        structure: "이 유튜브 쇼츠의 대본 구조를 분석해줘. 도입-전개-결말 구조, 긴장감 조성 방식, 클리프행어 사용 여부 등을 분석해줘."
      };

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: geminiKey,
          videoUrl: item.url,
          prompt: prompts[selectedMode]
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error||"오류가 발생했어요"); setLoading(false); return; }
      setText(data.result);
    } catch(e) { setError("오류: " + e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div><p className="text-xs text-gray-400 mb-0.5">📄 대본 / 분석</p><h2 className="text-sm font-black text-gray-900 line-clamp-1">{item.title}</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${copied?"bg-green-500 text-white":"bg-gray-100 text-gray-600"}`}>{copied?"✓ 복사됨":"복사"}</button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
        </div>

        <div className="px-5 pt-4 pb-2 space-y-2">
          {/* Gemini 버튼들 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { mode:"transcript", label:"📄 대본 추출", desc:"나레이션 전체" },
              { mode:"hook",       label:"🪝 훅 분석",   desc:"첫 3초 패턴" },
              { mode:"structure",  label:"🏗 구조 분석", desc:"대본 구조" },
            ].map(btn=>(
              <button key={btn.mode} onClick={()=>runGemini(btn.mode)} disabled={loading}
                className="py-2 rounded-2xl text-xs font-black disabled:opacity-40 flex flex-col items-center gap-0.5 transition-all"
                style={{background: mode===btn.mode&&!loading&&text?"#111":"#f3f4f6", color: mode===btn.mode&&!loading&&text?"white":"#374151"}}>
                {loading && mode===btn.mode
                  ? <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"/>
                  : <span>{btn.label}</span>
                }
                <span className="opacity-60 font-normal" style={{fontSize:"10px"}}>{btn.desc}</span>
              </button>
            ))}
          </div>
          {error&&<p className="text-xs text-red-500 text-center">{error}</p>}
          {!geminiKey&&<p className="text-xs text-amber-600 text-center bg-amber-50 rounded-xl px-3 py-2">⚙️ 설정에서 Gemini API 키를 등록해주세요</p>}
        </div>

        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder="Gemini 버튼을 눌러 자동으로 가져오거나 직접 입력하세요..."
          className="flex-1 p-5 text-sm text-gray-800 leading-relaxed outline-none resize-none placeholder-gray-300"
          style={{minHeight:"300px"}}/>
        <div className="p-4 border-t border-gray-100">
          <button onClick={()=>{onSave(item.id,text);onClose();}} className="w-full py-2.5 text-gray-900 text-sm font-black rounded-2xl" style={{background:"#FF8C00"}}>저장</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 메모 모달
// ─────────────────────────────────────────────
const MemoModal = ({ item, onClose, onSave }) => {
  const [text, setText] = useState(item.memo||"");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900 line-clamp-1">✏️ {item.title}</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} placeholder="소재 메모를 남겨보세요" className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none"/>
          <div className="flex gap-2 mt-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={()=>{onSave(item.id,text);onClose();}} className="flex-1 py-2.5 text-gray-900 text-sm font-black rounded-2xl" style={{background:"#FF8C00"}}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 태그 편집 모달
// ─────────────────────────────────────────────
const TagModal = ({ item, onClose, onSave, allTags }) => {
  const [selected, setSelected] = useState(item.tags||[]);
  const toggle = tag => setSelected(p=>p.includes(tag)?p.filter(t=>t!==tag):[...p,tag]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900">🏷️ 태그 설정</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-3 line-clamp-1">{item.title}</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag=>(
              <button key={tag} onClick={()=>toggle(tag)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${selected.includes(tag)?"text-gray-900":"bg-gray-100 text-gray-500"}`}
                style={selected.includes(tag)?{background:"#FF8C00"}:{}}>
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={()=>{onSave(item.id,selected);onClose();}} className="flex-1 py-2.5 text-gray-900 text-sm font-black rounded-2xl" style={{background:"#FF8C00"}}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 성과 기록 모달
// ─────────────────────────────────────────────
const MyViewsModal = ({ item, onClose, onSave }) => {
  const [views, setViews] = useState(item.myViews||"");
  const refViews = toViewsNum(item.views);
  const myNum = toViewsNum(views);
  const pct = refViews>0&&myNum>0 ? Math.round((myNum/refViews)*100) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900">📈 내 성과 기록</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-1 line-clamp-1">{item.title}</p>
          <p className="text-xs text-gray-400 mb-4">레퍼런스 조회수: <span className="font-bold text-gray-700">{item.views}</span></p>
          <label className="text-xs font-black text-gray-500 block mb-1">내 채널 조회수</label>
          <input value={views} onChange={e=>setViews(e.target.value)} placeholder="예: 50만" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none mb-3"/>
          {pct!==null&&(
            <div className={`rounded-2xl p-3 mb-3 text-center ${pct>=100?"bg-green-50":pct>=50?"bg-yellow-50":"bg-red-50"}`}>
              <p className={`text-2xl font-black ${pct>=100?"text-green-600":pct>=50?"text-yellow-600":"text-red-500"}`}>{pct}%</p>
              <p className={`text-xs font-medium ${pct>=100?"text-green-500":pct>=50?"text-yellow-500":"text-red-400"}`}>
                {pct>=100?"🔥 레퍼런스 초과 달성!":pct>=50?"👍 절반 이상 달성":"📉 레퍼런스 대비 낮음"}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={()=>{onSave(item.id,views);onClose();}} className="flex-1 py-2.5 text-gray-900 text-sm font-black rounded-2xl" style={{background:"#FF8C00"}}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 설정 모달
// ─────────────────────────────────────────────
const SettingsModal = ({ apiKey, onSave, geminiKey, onSaveGemini, openAiKey, onSaveOpenAi, onClose, allTags, onAddTag, onRemoveTag, taxonomy, onAddCategory, onRemoveCategory, onAddSub, onRemoveSub, onFixDates, onFixThumbnails, onRecalcMultipliers, onChangePassword }) => {
  const [key, setKey]         = useState(apiKey);
  const [gKey, setGKey]       = useState(geminiKey);
  const [oKey, setOKey]       = useState(openAiKey);
  const [showYt, setShowYt]   = useState(false);
  const [showGm, setShowGm]   = useState(false);
  const [showOai, setShowOai] = useState(false);
  const [newTag, setNewTag]   = useState("");
  const [newCatName, setNewCatName]   = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🎬");
  const [newCatColor, setNewCatColor] = useState("#E74C3C");
  const [expandedCat, setExpandedCat] = useState(null);
  const [newSub, setNewSub]           = useState("");
  const [newPw, setNewPw]             = useState("");
  const [showPw, setShowPw]           = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-gray-900">⚙️ 설정</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>

          {/* YouTube API 키 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">▶️</span>
              <label className="text-xs font-black text-gray-600">YouTube Data API v3 키</label>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                className="ml-auto text-xs text-blue-500 font-bold hover:underline">발급받기 →</a>
            </div>
            <div className="relative">
              <input type={showYt?"text":"password"} value={key} onChange={e=>setKey(e.target.value)} placeholder="AIzaSy..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-12 outline-none font-mono bg-white"/>
              <button onClick={()=>setShowYt(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showYt?"숨김":"표시"}</button>
            </div>
            {key&&key.startsWith("AIza")&&<p className="text-xs text-green-600 font-bold mt-1.5">✓ 유효한 키 형식이에요</p>}
          </div>

          {/* OpenAI API 키 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🤖</span>
              <label className="text-xs font-black text-gray-600">ChatGPT (OpenAI) API 키</label>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                className="ml-auto text-xs text-blue-500 font-bold hover:underline">발급받기 →</a>
            </div>
            <div className="relative">
              <input type={showOai?"text":"password"} value={oKey} onChange={e=>setOKey(e.target.value)} placeholder="sk-..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-12 outline-none font-mono bg-white"/>
              <button onClick={()=>setShowOai(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showOai?"숨김":"표시"}</button>
            </div>
            {oKey&&oKey.startsWith("sk-")&&<p className="text-xs text-green-600 font-bold mt-1.5">✓ 유효한 키 형식이에요</p>}
          </div>

          {/* Gemini API 키 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">✨</span>
              <label className="text-xs font-black text-gray-600">Gemini API 키</label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                className="ml-auto text-xs text-blue-500 font-bold hover:underline">발급받기 →</a>
            </div>
            <div className="relative">
              <input type={showGm?"text":"password"} value={gKey} onChange={e=>setGKey(e.target.value)} placeholder="AIzaSy..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-12 outline-none font-mono bg-white"/>
              <button onClick={()=>setShowGm(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showGm?"숨김":"표시"}</button>
            </div>
            {gKey&&gKey.startsWith("AIza")&&<p className="text-xs text-green-600 font-bold mt-1.5">✓ 유효한 키 형식이에요</p>}
          </div>

          {/* 카테고리 관리 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <label className="text-xs font-black text-gray-600 block mb-3">📂 카테고리 관리</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(taxonomy).map(([name,{emoji,color,subs}])=>(
                <div key={name} className="w-full">
                  <div className="flex items-center gap-1 rounded-xl px-2.5 py-1.5" style={{backgroundColor:color+"15",border:`1px solid ${color}30`}}>
                    <span className="text-xs">{emoji}</span>
                    <span className="text-xs font-bold flex-1" style={{color}}>{name}</span>
                    {name!=="전체"&&(
                      <>
                        <button onClick={()=>setExpandedCat(expandedCat===name?null:name)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1">
                          {expandedCat===name?"▲":"소분류"}
                        </button>
                        <button onClick={()=>onRemoveCategory(name)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </>
                    )}
                  </div>
                  {expandedCat===name&&(
                    <div className="mt-1 ml-3 p-2 bg-gray-50 rounded-xl">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(subs||[]).filter(s=>s!=="전체").map(sub=>(
                          <div key={sub} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                            <span className="text-xs text-gray-700">{sub}</span>
                            <button onClick={()=>onRemoveSub(name,sub)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input value={newSub} onChange={e=>setNewSub(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"&&newSub.trim()){onAddSub(name,newSub.trim());setNewSub("");}}}
                          placeholder="소분류 추가..." className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"/>
                        <button onClick={()=>{if(newSub.trim()){onAddSub(name,newSub.trim());setNewSub("");}}}
                          className="px-2 py-1.5 rounded-lg text-xs font-black text-gray-900" style={{background:"#FF8C00"}}>추가</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input value={newCatEmoji} onChange={e=>setNewCatEmoji(e.target.value)}
                className="w-12 text-center text-sm border border-gray-200 rounded-xl py-2 outline-none" placeholder="🎬"/>
              <input value={newCatName} onChange={e=>setNewCatName(e.target.value)}
                placeholder="카테고리 이름" className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none"/>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex flex-wrap gap-1 flex-1">
                {CAT_COLORS.slice(0,8).map(c=>(
                  <button key={c} onClick={()=>setNewCatColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{backgroundColor:c, borderColor:newCatColor===c?"#000":"transparent"}}/>
                ))}
              </div>
              <button onClick={()=>{if(newCatName.trim()){onAddCategory(newCatName.trim(),newCatEmoji,newCatColor);setNewCatName("");}}}
                className="px-3 py-2 rounded-xl text-xs font-black text-gray-900 flex-shrink-0" style={{background:"#FF8C00"}}>추가</button>
            </div>
          </div>

          {/* 태그 관리 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <label className="text-xs font-black text-gray-600 block mb-3">🏷️ 태그 관리</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {allTags.map(tag=>(
                <div key={tag} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                  <span className="text-xs font-bold text-gray-700">{tag}</span>
                  <button onClick={()=>onRemoveTag(tag)} className="text-gray-400 hover:text-red-500 text-xs ml-1">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newTag.trim()){onAddTag(newTag.trim());setNewTag("");}}}
                placeholder="새 태그 추가..." className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none"/>
              <button onClick={()=>{if(newTag.trim()){onAddTag(newTag.trim());setNewTag("");}}} className="px-3 py-2 rounded-xl text-xs font-black text-gray-900" style={{background:"#FF8C00"}}>추가</button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-3 mb-3">
            <p className="text-xs font-bold text-blue-700 mb-1">🔒 보안 안내</p>
            <p className="text-xs text-blue-600">모든 API 키는 이 브라우저에만 저장돼요. 서버로 전송되지 않아요.</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 mb-3">
            <p className="text-xs font-bold text-orange-700 mb-1">🛠️ 데이터 관리</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>{onClose();setTimeout(()=>onFixDates(),100);}} className="text-xs font-black px-3 py-1.5 rounded-xl text-white" style={{background:"#f97316"}}>
                🔧 날짜 일괄 업데이트
              </button>
              <button onClick={()=>{onClose();setTimeout(()=>onFixThumbnails(),100);}} className="text-xs font-black px-3 py-1.5 rounded-xl bg-red-500 text-white">
                🖼️ 썸네일 복구
              </button>
              <button onClick={()=>{onClose();setTimeout(()=>onRecalcMultipliers(),100);}} className="text-xs font-black px-3 py-1.5 rounded-xl bg-purple-500 text-white">
                📊 배수 재계산
              </button>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <label className="text-xs font-black text-gray-600 block mb-2">🔑 비밀번호 변경</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showPw?"text":"password"} value={newPw} onChange={e=>setNewPw(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-12 outline-none"/>
                <button onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showPw?"숨김":"표시"}</button>
              </div>
              <button onClick={()=>{
                if(!newPw.trim()||newPw.length<4){alert("4자 이상 입력해주세요");return;}
                onChangePassword(newPw.trim());setNewPw("");alert("✅ 비밀번호 변경됐어요!");
              }} className="px-3 py-2.5 rounded-xl text-xs font-black text-gray-900 flex-shrink-0" style={{background:"#FF8C00"}}>변경</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={()=>{onSave(key);onSaveGemini(gKey);onSaveOpenAi(oKey);onClose();}} className="flex-1 py-3 rounded-2xl text-sm font-black text-gray-900" style={{background:"#FF8C00"}}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 채널 수집 모달
// ─────────────────────────────────────────────
const ChannelFetchModal = ({ apiKey, onAdd, onClose, onRegisterChannel }) => {
  const [channelUrl, setChannelUrl] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [selectedCat, setSelectedCat] = useState("전체");
  const [loading, setLoading]       = useState(false);
  const [preview, setPreview]       = useState([]);
  const [error, setError]           = useState("");
  const [step, setStep]             = useState("input");
  const mainCats = Object.keys(TAXONOMY);

  const extractChannelId = async (url) => {
    const cleanUrl = url.split("?")[0].trim();
    const idMatch = cleanUrl.match(/channel\/(UC[\w-]+)/);
    if (idMatch) return idMatch[1];
    const directId = cleanUrl.match(/(UC[\w-]{22})/);
    if (directId) return directId[1];
    const handleMatch = cleanUrl.match(/@([\w.-]+)/);
    if (handleMatch) {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handleMatch[1]}&key=${apiKey}`);
      const data = await res.json();
      return data.items?.[0]?.id?.channelId||null;
    }
    return null;
  };

  const fetchVideos = async () => {
    if (!channelUrl.trim()) return;
    if (!apiKey||!apiKey.startsWith("AIza")) { setError("API 키를 먼저 설정에서 등록해주세요!"); return; }
    setLoading(true); setError(""); setPreview([]);
    try {
      const channelId = await extractChannelId(channelUrl);
      if (!channelId) { setError("채널을 찾을 수 없어요."); setLoading(false); return; }
      const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`);
      const searchData = await searchRes.json();
      if (searchData.error) { setError(`API 오류: ${searchData.error.message}`); setLoading(false); return; }
      const videoIds = searchData.items?.map(i=>i.id.videoId).join(",");
      const vidRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`);
      const vidData = await vidRes.json();
      const totalViews = vidData.items?.reduce((s,v)=>s+parseInt(v.statistics?.viewCount||0),0)||1;
      const avgViews = totalViews/(vidData.items?.length||1);
      const cards = vidData.items?.map(v=>{
        const views = parseInt(v.statistics?.viewCount||0);
        const multiplier = (views/avgViews).toFixed(1);
        const viewsStr = views>=10000000?`${(views/10000000).toFixed(1)}천만`:views>=1000000?`${(views/1000000).toFixed(0)}백만`:views>=10000?`${Math.round(views/10000)}만`:`${views}`;
        const daysDiff = Math.floor((Date.now()-new Date(v.snippet.publishedAt))/86400000);
        const daysAgo = daysDiff===0?"오늘":daysDiff<=3?`${daysDiff}일 전`:daysDiff<=14?"1주일 전":daysDiff<=45?"1개월 전":daysDiff<=75?"2개월 전":daysDiff<=105?"3개월 전":daysDiff<=210?"6개월 전":daysDiff<=395?"1년 전":"2년 전";
        return { id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle, views:viewsStr, multiplier:`×${multiplier}`, mainCat:selectedCat, subCat:"", daysAgo, url:`https://youtube.com/watch?v=${v.id}`, channelUrl:channelUrl, thumbnail:v.snippet.thumbnails?.medium?.url||"", publishedAt:v.snippet?.publishedAt||"", addedAt:new Date().toISOString(), bookmarked:false, memo:"", script:"", tags:[], myViews:"", _selected:true };
      })||[];
      setPreview(cards); setStep("preview");
    } catch(e) { setError("수집 중 오류가 발생했어요. API 키나 채널 URL을 확인해주세요."); }
    setLoading(false);
  };

  const toggleSel = id => setPreview(p=>p.map(c=>c.id===id?{...c,_selected:!c._selected}:c));
  const addSelected = () => { preview.filter(c=>c._selected).forEach(({_selected,...c})=>onAdd({...c,id:Date.now()+Math.random()})); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div><h2 className="text-base font-black text-gray-900">📡 채널 자동 수집</h2><p className="text-xs text-gray-400 mt-0.5">채널 URL로 영상을 자동으로 가져와요</p></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>
        {step==="input"&&(
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-black text-gray-600 block mb-2">채널 URL</label>
              <input value={channelUrl} onChange={e=>setChannelUrl(e.target.value)} placeholder="https://www.youtube.com/@채널명"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-400"/>
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 block mb-2">카테고리 설정 (수집된 카드에 일괄 적용)</label>
              <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                {mainCats.map(c=><option key={c} value={c}>{TAXONOMY[c]?.emoji} {c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 block mb-2">가져올 영상 수</label>
              <div className="flex gap-2">
                {[10,20,30,50].map(n=>(
                  <button key={n} onClick={()=>setMaxResults(n)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${maxResults===n?"text-gray-900":"bg-gray-100 text-gray-500"}`} style={maxResults===n?{background:"#FF8C00"}:{}}>{n}개</button>
                ))}
              </div>
            </div>
            {error&&<p className="text-sm text-red-500 font-medium bg-red-50 rounded-xl px-4 py-3">⚠️ {error}</p>}
            <button onClick={fetchVideos} disabled={loading||!channelUrl.trim()||!apiKey}
              className="w-full py-3 rounded-2xl text-sm font-black text-gray-900 disabled:opacity-40" style={{background:"#FF8C00"}}>
              {loading?"수집 중...":"🚀 영상 가져오기"}
            </button>
            {loading&&<div className="flex items-center justify-center gap-2 text-gray-400"><div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin"/><p className="text-xs">데이터 가져오는 중...</p></div>}
          </div>
        )}
        {step==="preview"&&(
          <>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">{preview.length}개 수집</span>
                <span className="text-xs text-gray-400">· {preview.filter(c=>c._selected).length}개 선택</span>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setPreview(p=>p.map(c=>({...c,_selected:true})))} className="text-xs font-bold text-gray-500">전체선택</button>
                <button onClick={()=>setPreview(p=>p.map(c=>({...c,_selected:false})))} className="text-xs font-bold text-gray-500">전체해제</button>
                <button onClick={()=>setStep("input")} className="text-xs font-bold text-blue-500">← 다시</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2" style={{maxHeight:"50vh"}}>
              {preview.map(card=>(
                <div key={card.id} onClick={()=>toggleSel(card.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${card._selected?"border-gray-900 bg-gray-50":"border-gray-100 hover:border-gray-200"}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${card._selected?"border-gray-900 bg-gray-900":"border-gray-300"}`}>
                    {card._selected&&<span className="text-white text-xs">✓</span>}
                  </div>
                  <img src={card.thumbnail} className="w-16 h-10 object-cover rounded-lg flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{card.title}</p>
                    <p className="text-xs text-gray-400">{card.channel} · {card.views} · {getDisplayDate(card)}</p>
                  </div>
                  <div className="text-xs font-black text-gray-700">{card.multiplier}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-2">
              <button onClick={addSelected} disabled={preview.filter(c=>c._selected).length===0}
                className="w-full py-3 rounded-2xl text-sm font-black text-gray-900 disabled:opacity-40" style={{background:"#FF8C00"}}>
                ✅ {preview.filter(c=>c._selected).length}개 갤러리에 추가
              </button>
              {onRegisterChannel&&preview.length>0&&(
                <button onClick={()=>{
                  addSelected();
                  const extractedId = channelUrl.match(/channel\/(UC[\w-]+)/)?.[1] || channelUrl.match(/(UC[\w-]{22})/)?.[1] || "";
                  onRegisterChannel({id: extractedId, name:preview[0].channel, category:selectedCat, url:channelUrl});
                }}
                  disabled={preview.filter(c=>c._selected).length===0}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold text-blue-600 border-2 border-blue-200 hover:bg-blue-50 disabled:opacity-40">
                  🔄 추가 + 레퍼런스 채널 등록 (새 영상 자동 업데이트)
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// AI 분석 모달
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 카테고리 자동 수집 모달
// ─────────────────────────────────────────────
const CAT_KEYWORDS = {
  "영화 및 애니메이션": "드라마 영화 애니 클립 쇼츠",
  "음악": "음악 뮤직비디오 커버 쇼츠",
  "교육": "지식 역사 과학 교육 쇼츠",
  "과학기술": "과학 기술 AI 실험 쇼츠",
  "뉴스/정치": "뉴스 시사 정치 이슈 쇼츠",
  "노하우/스타일": "꿀팁 뷰티 인테리어 요리 쇼츠",
  "인물/블로그": "브이로그 일상 스토리 반응 쇼츠",
  "코미디": "웃긴 개그 코미디 밈 쇼츠",
  "스포츠": "스포츠 축구 야구 운동 쇼츠",
  "게임": "게임 클립 플레이 쇼츠",
  "반려동물/동물": "강아지 고양이 동물 쇼츠",
  "여행 및 행사": "여행 맛집 국내 해외 쇼츠",
  "자동차 및 탈것": "자동차 차량 드라이브 쇼츠",
  "엔터테인먼트": "엔터 예능 연예 인기 쇼츠",
};

// 영상 추가 모달
// ─────────────────────────────────────────────
const VideoAddModal = ({ onAdd, onClose, apiKey }) => {
  const [url, setUrl]         = useState("");
  const [title, setTitle]     = useState("");
  const [channel, setChannel] = useState("");
  const [thumbnail, setThumb] = useState("");
  const [views, setViews]     = useState("");
  const [selectedCat, setCat] = useState("전체");
  const [fetching, setFetching] = useState(false);
  const [error, setError]     = useState("");
  const mainCats = Object.keys(TAXONOMY);

  const extractVideoId = (u) => {
    const m = u.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m?.[1]||null;
  };

  const fetchMeta = async () => {
    if (!url.trim()) return;
    setFetching(true); setError("");
    try {
      const vid = extractVideoId(url);
      // oEmbed로 기본 정보
      const res  = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      const data = await res.json();
      setTitle(data.title||"");
      setChannel(data.author_name||"");
      setThumb(vid?`https://img.youtube.com/vi/${vid}/mqdefault.jpg`:"");
      // API 키 있으면 조회수도 자동으로
      if (apiKey&&apiKey.startsWith("AIza")&&vid) {
        const vRes  = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${vid}&key=${apiKey}`);
        const vData = await vRes.json();
        const v = parseInt(vData.items?.[0]?.statistics?.viewCount||0);
        if (v>0) {
          const str = v>=10000000?`${(v/10000000).toFixed(1)}천만`:v>=1000000?`${(v/1000000).toFixed(0)}백만`:v>=10000?`${Math.round(v/10000)}만`:`${v}`;
          setViews(str);
        }
      }
    } catch { setError("영상 정보를 가져올 수 없어요. URL을 확인해주세요."); }
    setFetching(false);
  };

  const handleAdd = () => {
    if (!url.trim()||!title.trim()) { setError("URL과 제목은 필수예요"); return; }
    onAdd({
      id: Date.now()+Math.random(),
      title, channel, views: views||"?", multiplier:"×?",
      mainCat: selectedCat, subCat:"", daysAgo:"직접추가",
      url, thumbnail, addedAt:new Date().toISOString(), bookmarked:false, memo:"", script:"", tags:[], myViews:""
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">🎬 영상 추가</h2>
            <p className="text-xs text-gray-400 mt-0.5">YouTube URL 하나로 바로 추가해요</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-black text-gray-600 block mb-2">YouTube URL</label>
            <div className="flex gap-2">
              <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchMeta()}
                placeholder="https://youtube.com/shorts/..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400"/>
              <button onClick={fetchMeta} disabled={fetching||!url.trim()}
                className="px-3 py-2.5 rounded-xl text-xs font-black text-gray-900 disabled:opacity-40 flex-shrink-0"
                style={{background:"#FF8C00"}}>
                {fetching?<div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"/>:"자동완성"}
              </button>
            </div>
            {error&&<p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {thumbnail&&(
            <div className="flex gap-3 items-start bg-gray-50 rounded-2xl p-3">
              <img src={thumbnail} className="w-20 h-14 object-cover rounded-xl flex-shrink-0"/>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 line-clamp-2">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{channel}</p>
                {views&&<p className="text-xs font-bold text-blue-500 mt-0.5">👁 {views}</p>}
              </div>
            </div>
          )}

          {!thumbnail&&title&&(
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-xs font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{channel}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-black text-gray-600 block mb-2">카테고리</label>
            <select value={selectedCat} onChange={e=>setCat(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
              {mainCats.map(c=><option key={c} value={c}>{TAXONOMY[c]?.emoji} {c}</option>)}
            </select>
          </div>

          <button onClick={handleAdd} disabled={!url.trim()||!title.trim()}
            className="w-full py-3 rounded-2xl text-sm font-black text-gray-900 disabled:opacity-40"
            style={{background:"#FF8C00"}}>
            ✅ 갤러리에 추가
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryAutoFetchModal = ({ apiKey, onAdd, onClose }) => {
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading]       = useState(false);
  const [preview, setPreview]       = useState([]);
  const [error, setError]           = useState("");
  const [step, setStep]             = useState("input");

  const fetchTrending = async () => {
    if (!apiKey||!apiKey.startsWith("AIza")) { setError("API 키를 먼저 설정에서 등록해주세요!"); return; }
    setLoading(true); setError(""); setPreview([]);
    try {
      // 한국 인기 급상승 영상 (videoCategoryId 없이 chart=mostPopular)
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=${maxResults}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.error) { setError(`API 오류: ${data.error.message}`); setLoading(false); return; }
      if (!data.items?.length) { setError("영상을 찾을 수 없어요."); setLoading(false); return; }

      const totalViews = data.items.reduce((s,v)=>s+parseInt(v.statistics?.viewCount||0),0)||1;
      const avgViews   = totalViews/data.items.length;

      const cards = data.items.map(v=>{
        const views    = parseInt(v.statistics?.viewCount||0);
        const multi    = (views/avgViews).toFixed(1);
        const viewsStr = views>=10000000?`${(views/10000000).toFixed(1)}천만`:views>=1000000?`${(views/1000000).toFixed(0)}백만`:views>=10000?`${Math.round(views/10000)}만`:`${views}`;
        const daysDiff = Math.floor((Date.now()-new Date(v.snippet.publishedAt))/86400000);
        const daysAgo  = daysDiff===0?"오늘":daysDiff<=3?`${daysDiff}일 전`:daysDiff<=14?"1주일 전":daysDiff<=45?"1개월 전":daysDiff<=75?"2개월 전":daysDiff<=105?"3개월 전":daysDiff<=210?"6개월 전":daysDiff<=395?"1년 전":"2년 전";
        return { id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle, views:viewsStr, multiplier:`×${multi}`, mainCat:"전체", subCat:"", daysAgo, url:`https://youtube.com/watch?v=${v.id}`, thumbnail:v.snippet.thumbnails?.medium?.url||"", publishedAt:v.snippet?.publishedAt||"", addedAt:new Date().toISOString(), bookmarked:false, memo:"", script:"", tags:[], myViews:"", _selected:true };
      });
      setPreview(cards); setStep("preview");
    } catch(e) { setError("수집 중 오류가 발생했어요."); }
    setLoading(false);
  };

  const toggleSel   = id => setPreview(p=>p.map(c=>c.id===id?{...c,_selected:!c._selected}:c));
  const addSelected = () => { preview.filter(c=>c._selected).forEach(({_selected,...c})=>onAdd({...c,id:Date.now()+Math.random()})); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">🔥 한국 인기 급상승 수집</h2>
            <p className="text-xs text-gray-400 mt-0.5">지금 한국에서 가장 인기 있는 영상을 가져와요</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>

        {step==="input"&&(
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-sm text-gray-600 leading-relaxed">지금 한국에서 급상승 중인 영상들을 가져와요. 수집 후 카테고리는 직접 분류할 수 있어요.</p>
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 block mb-2">가져올 영상 수</label>
              <div className="flex gap-2">
                {[10,20,30,50].map(n=>(
                  <button key={n} onClick={()=>setMaxResults(n)} className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                    style={maxResults===n?{background:"#FF8C00",color:"#111"}:{backgroundColor:"#f3f4f6",color:"#6b7280"}}>
                    {n}개
                  </button>
                ))}
              </div>
            </div>
            {error&&<p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">⚠️ {error}</p>}
            {!apiKey&&<p className="text-xs text-yellow-700 bg-yellow-50 rounded-xl px-4 py-3">⚠️ API 키를 먼저 ⚙️ 설정에서 등록해주세요</p>}
            <button onClick={fetchTrending} disabled={loading||!apiKey}
              className="w-full py-3 rounded-2xl text-sm font-black text-gray-900 disabled:opacity-40"
              style={{background:"#FF8C00"}}>
              {loading?"수집 중...":"🚀 한국 인기 급상승 가져오기"}
            </button>
            {loading&&<div className="flex items-center justify-center gap-2 text-gray-400"><div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin"/><p className="text-xs">YouTube 급상승 데이터 가져오는 중...</p></div>}
          </div>
        )}

        {step==="preview"&&(
          <>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">{preview.length}개 수집</span>
                <span className="text-xs text-gray-400">· {preview.filter(c=>c._selected).length}개 선택</span>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setPreview(p=>p.map(c=>({...c,_selected:true})))} className="text-xs font-bold text-gray-500">전체선택</button>
                <button onClick={()=>setPreview(p=>p.map(c=>({...c,_selected:false})))} className="text-xs font-bold text-gray-500">전체해제</button>
                <button onClick={()=>setStep("input")} className="text-xs font-bold text-blue-500">← 다시</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {preview.map(card=>(
                <div key={card.id} onClick={()=>toggleSel(card.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${card._selected?"border-gray-900 bg-gray-50":"border-gray-100 hover:border-gray-200"}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${card._selected?"border-gray-900 bg-gray-900":"border-gray-300"}`}>
                    {card._selected&&<span className="text-white text-xs">✓</span>}
                  </div>
                  <img src={card.thumbnail} className="w-16 h-10 object-cover rounded-lg flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{card.title}</p>
                    <p className="text-xs text-gray-400">{card.channel} · {card.views} · {getDisplayDate(card)}</p>
                  </div>
                  <div className="text-xs font-black text-gray-700">{card.multiplier}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={addSelected} disabled={preview.filter(c=>c._selected).length===0}
                className="w-full py-3 rounded-2xl text-sm font-black text-gray-900 disabled:opacity-40"
                style={{background:"#FF8C00"}}>
                ✅ {preview.filter(c=>c._selected).length}개 갤러리에 추가
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 내 채널 분석 탭
// ─────────────────────────────────────────────
// 채널 탭
// ─────────────────────────────────────────────
// 국밥리스트 탭
// ─────────────────────────────────────────────
const SAFETY_COLORS = { "안전": "#22c55e", "주의": "#f59e0b", "위험": "#ef4444" };
const GENRES = ["범죄스릴러","코미디","로맨스","드라마","예능","역사","액션","공포","SF","다큐","기타"];

const GukbapTab = () => {
  const REPO = "100hoone/zeroclip";
  const FILE = "gukbap.json";
  const LS_KEY = "gukbap_list";

  // localStorage를 1차 데이터소스로 사용
  const [list, setList]           = useState(()=>{ try{ return JSON.parse(localStorage.getItem(LS_KEY)||"[]"); }catch{ return []; } });
  const [syncing, setSyncing]     = useState(true); // 처음엔 항상 동기화 중
  const [isAdmin, setIsAdmin]     = useState(false);
  const [adminPw, setAdminPw]     = useState("");
  const [adminToken, setAdminToken] = useState(()=>localStorage.getItem("gb_admin_token")||"");
  const [showLogin, setShowLogin] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [filterGenre, setFilterGenre] = useState("전체");
  const [selected, setSelected]   = useState(null);
  const [form, setForm] = useState({ title:"", genre:"범죄스릴러", producer:"", distributor:"", platform:"", safety:"안전", memo:"", thumbnail:"" });

  // localStorage에 저장
  const saveLocal = (newList) => {
    setList(newList);
    localStorage.setItem(LS_KEY, JSON.stringify(newList));
  };

  // GitHub에서 최신 데이터 가져오기 (백그라운드 동기화)
  const syncFromGitHub = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
        headers: { Accept: "application/vnd.github.v3+json", "Cache-Control": "no-cache", "Pragma": "no-cache" },
        cache: "no-store"
      });
      const data = await res.json();
      if (data.content) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g,"")))));
        if (Array.isArray(decoded)) {
          saveLocal(decoded);
        }
      }
    } catch(e) { console.error("GitHub sync failed:", e); }
    setSyncing(false);
  };

  useEffect(()=>{ syncFromGitHub(); },[]);

  // GitHub에 저장
  const saveToGitHub = async (newList) => {
    const fileRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
      headers: { Authorization: `token ${adminToken}`, Accept: "application/vnd.github.v3+json", cache: "no-store" }
    });
    const fileData = await fileRes.json();
    if (!fileRes.ok) throw new Error(fileData.message||"파일 조회 실패");
    const saveRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
      method: "PUT",
      headers: { Authorization: `token ${adminToken}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update gukbap list",
        content: btoa(unescape(encodeURIComponent(JSON.stringify(newList, null, 2)))),
        sha: fileData.sha, branch: "main"
      })
    });
    if (!saveRes.ok) { const d = await saveRes.json(); throw new Error(d.message||"저장 실패"); }
  };

  const handleLogin = () => {
    if (adminPw !== "100stu!") { alert("비밀번호가 틀렸어요"); return; }
    if (!adminToken.trim()) { alert("GitHub 토큰을 입력해주세요"); return; }
    localStorage.setItem("gb_admin_token", adminToken);
    setIsAdmin(true); setShowLogin(false);
  };

  const adminAction = async (action, item, id) => {
    setSaving(true);
    try {
      let newList = [...list];
      if (action==="add") newList.unshift({ id:Date.now(), ...item, addedAt:new Date().toISOString() });
      else if (action==="edit") { const i=newList.findIndex(x=>x.id===id); if(i>=0) newList[i]={...newList[i],...item}; }
      else if (action==="delete") newList=newList.filter(x=>x.id!==id);

      // 1. 즉시 localStorage 저장 (화면 바로 반영)
      saveLocal(newList);
      setShowForm(false); setEditItem(null);
      setForm({title:"",genre:"범죄스릴러",producer:"",distributor:"",platform:"",safety:"안전",memo:"",thumbnail:""});

      // 2. 백그라운드로 GitHub 저장
      await saveToGitHub(newList);
      alert("✅ 저장됐어요!");
    } catch(e) { alert("GitHub 저장 오류: "+e.message); }
    setSaving(false);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({title:item.title,genre:item.genre,producer:item.producer||"",distributor:item.distributor||"",platform:item.platform||"",safety:item.safety,memo:item.memo||"",thumbnail:item.thumbnail||""});
    setShowForm(true);
  };

  const filtered = filterGenre==="전체" ? list : list.filter(i=>i.genre===filterGenre);
  const genres = [...new Set(list.map(i=>i.genre))].filter(Boolean);
  const SAFETY_COLOR = {"안전":"#22c55e","주의":"#f59e0b","위험":"#ef4444"};

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">🍚 국밥리스트</h2>
          <p className="text-xs text-gray-400 mt-0.5">귤쌤이 직접 선별한 제작 안전 작품 모음</p>
        </div>
        <div className="flex gap-2 items-center">
          {syncing&&<span className="text-xs text-gray-400">동기화 중...</span>}
          <button onClick={syncFromGitHub} disabled={syncing} className="text-xs font-bold px-3 py-1.5 rounded-xl text-gray-400 bg-gray-100 hover:bg-gray-200 disabled:opacity-40">🔄</button>
          {isAdmin ? (
            <>
              <button onClick={()=>{setEditItem(null);setForm({title:"",genre:"범죄스릴러",producer:"",distributor:"",platform:"",safety:"안전",memo:"",thumbnail:""});setShowForm(true);}}
                className="text-xs font-black px-4 py-1.5 rounded-xl text-white" style={{background:"#FF8C00"}}>
                + 작품 추가
              </button>
              <button onClick={()=>setIsAdmin(false)} className="text-xs font-bold px-3 py-1.5 rounded-xl text-gray-400 bg-gray-100">로그아웃</button>
            </>
          ) : (
            <button onClick={()=>setShowLogin(true)} className="text-xs font-bold px-3 py-1.5 rounded-xl text-gray-400 bg-gray-100">관리자</button>
          )}
        </div>
      </div>

      {/* 장르 탭 */}
      {genres.length>0&&(
        <div className="flex gap-2 mb-6 flex-wrap">
          {["전체",...genres].map(g=>(
            <button key={g} onClick={()=>setFilterGenre(g)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              style={filterGenre===g?{background:"#FF8C00",color:"white"}:{background:"#f3f4f6",color:"#6b7280"}}>
              {g} {g==="전체"?list.length:list.filter(i=>i.genre===g).length}
            </button>
          ))}
        </div>
      )}

      {/* 카드 그리드 */}
      {syncing && list.length === 0 ? (
        <div className="flex flex-col items-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-orange-400 animate-spin mb-3"/>
          <p className="text-sm text-gray-400">목록 불러오는 중...</p>
        </div>
      ) : filtered.length===0 ? (
        <div className="flex flex-col items-center py-24 text-gray-300">
          <span className="text-5xl mb-3">🍚</span>
          <p className="font-bold text-gray-400">아직 등록된 작품이 없어요</p>
          {isAdmin&&<p className="text-sm text-gray-300 mt-1">+ 작품 추가 버튼으로 등록해보세요</p>}
        </div>
      ) : (
        <div className="grid gap-5" style={{gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))"}}>
          {filtered.map(item=>(
            <div key={item.id} className="group cursor-pointer" onClick={()=>setSelected(selected?.id===item.id?null:item)}>
              <div className="relative rounded-2xl overflow-hidden mb-3 shadow-sm" style={{aspectRatio:"2/3"}}>
                {item.thumbnail ? (
                  <img src={item.thumbnail} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gray-100">🎬</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
                <div className="absolute top-2 left-2">
                  {item.genre&&<span className="text-xs font-black px-2 py-0.5 rounded-lg text-white" style={{background:"rgba(0,0,0,0.6)"}}>{item.genre}</span>}
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded-lg text-white" style={{background:SAFETY_COLOR[item.safety]||"#22c55e"}}>{item.safety}</span>
                </div>
                {isAdmin&&(
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <button onClick={e=>{e.stopPropagation();openEdit(item);}} className="text-xs font-black px-3 py-1.5 rounded-xl text-white" style={{background:"#FF8C00"}}>✏️ 수정</button>
                  </div>
                )}
              </div>
              <p className="text-sm font-black text-gray-900 leading-snug mb-0.5">{item.title}</p>
              {item.producer&&<p className="text-xs text-gray-500">제작 {item.producer}</p>}
              {item.distributor&&<p className="text-xs text-gray-500">배급 {item.distributor}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 하단 상세 */}
      {selected&&(
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 pb-6" style={{background:"linear-gradient(to top, white 85%, transparent)"}}>
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 shadow-xl border border-gray-100">
            <div className="flex gap-4">
              {selected.thumbnail&&<img src={selected.thumbnail} className="w-16 h-24 object-cover object-top rounded-xl flex-shrink-0"/>}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-base font-black text-gray-900">{selected.title}</p>
                  <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-700 text-lg flex-shrink-0">✕</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{background:SAFETY_COLOR[selected.safety]||"#22c55e"}}>한줄평: {selected.safety}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-50 text-orange-500">{selected.genre}</span>
                  {selected.platform&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{selected.platform}</span>}
                </div>
                {selected.producer&&<p className="text-xs text-gray-500">제작사: {selected.producer}</p>}
                {selected.distributor&&<p className="text-xs text-gray-500">배급사: {selected.distributor}</p>}
                {selected.memo&&<p className="text-xs text-gray-500 mt-2 leading-relaxed">{selected.memo}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 로그인 */}
      {showLogin&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={()=>setShowLogin(false)}>
          <div className="bg-white rounded-3xl p-6 w-80 shadow-2xl space-y-3" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-black text-gray-900">🔐 관리자 로그인</h3>
            <input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)}
              placeholder="관리자 비밀번호" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none"/>
            <input type="password" value={adminToken} onChange={e=>setAdminToken(e.target.value)}
              placeholder="GitHub 토큰 (ghp_...)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none font-mono"/>
            <p className="text-xs text-gray-400">토큰은 이 브라우저에만 저장돼요</p>
            <div className="flex gap-2">
              <button onClick={handleLogin} className="flex-1 py-2.5 rounded-xl text-sm font-black text-white" style={{background:"#FF8C00"}}>입장</button>
              <button onClick={()=>setShowLogin(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 작품 폼 */}
      {showForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">{editItem?"작품 수정":"작품 추가"}</h3>
              <button onClick={()=>setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                {label:"작품명 *", key:"title", placeholder:"예: 더 글로리"},
                {label:"제작사", key:"producer", placeholder:"예: 화앤담픽처스"},
                {label:"배급사", key:"distributor", placeholder:"예: 넷플릭스"},
                {label:"플랫폼", key:"platform", placeholder:"예: Netflix, 웨이브 등"},
                {label:"썸네일 URL", key:"thumbnail", placeholder:"https://..."},
              ].map(f=>(
                <div key={f.key}>
                  <label className="text-xs font-black text-gray-600 block mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-300"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-gray-600 block mb-1">장르</label>
                  <select value={form.genre} onChange={e=>setForm(p=>({...p,genre:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                    {GENRES.map(g=><option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-600 block mb-1">안전도</label>
                  <select value={form.safety} onChange={e=>setForm(p=>({...p,safety:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                    {["안전","주의","위험"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-600 block mb-1">메모</label>
                <textarea value={form.memo} onChange={e=>setForm(p=>({...p,memo:e.target.value}))}
                  placeholder="특이사항 등" rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-orange-300"/>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={()=>adminAction(editItem?"edit":"add",form,editItem?.id)} disabled={!form.title.trim()||saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{background:"#FF8C00"}}>
                  {saving?"저장 중...":editItem?"수정 완료":"추가"}
                </button>
                {editItem&&<button onClick={()=>{if(window.confirm("삭제할까요?"))adminAction("delete",null,editItem.id);}} disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 bg-red-50">삭제</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChannelsTab = ({ cards, refChannels, saveRefChannels, apiKey, onBulkCatChange, onFilterChannel }) => {
  const [selectedCh, setSelectedCh]     = useState(null);
  const [editingCh, setEditingCh]       = useState(null);
  const [bulkMainCat, setBulkMainCat]   = useState("전체");
  const [bulkSubCats, setBulkSubCats]   = useState([]);
  const [chSearch, setChSearch]         = useState("");
  const [filterCat, setFilterCat]       = useState("전체");

  // 채널 바뀔 때 상태 리셋
  const selectChannel = (name) => {
    setSelectedCh(name);
    setEditingCh(null);
    setBulkMainCat("전체");
    setBulkSubCats([]);
  }; // 채널 목록 카테고리 필터

  const channels = useMemo(()=>{
    const map = {};
    cards.forEach(c=>{
      if (!c.channel) return;
      if (!map[c.channel]) map[c.channel] = { name:c.channel, count:0, cats:{}, thumbnail:"", mainCat:"전체" };
      map[c.channel].count++;
      map[c.channel].cats[c.mainCat] = (map[c.channel].cats[c.mainCat]||0)+1;
      if (!map[c.channel].thumbnail && c.thumbnail) map[c.channel].thumbnail = c.thumbnail;
      const topCat = Object.entries(map[c.channel].cats).sort((a,b)=>b[1]-a[1])[0]?.[0]||"전체";
      map[c.channel].mainCat = topCat;
    });
    return Object.values(map).sort((a,b)=>b.count-a.count);
  },[cards]);

  // 카테고리별 채널 수 집계 (미니 대시보드용)
  const catStats = useMemo(()=>{
    const map = {};
    channels.forEach(ch=>{ map[ch.mainCat]=(map[ch.mainCat]||0)+1; });
    return map;
  },[channels]);

  const toggleBulkSub = s => setBulkSubCats(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);

  const filtered = channels
    .filter(c=>filterCat==="전체"||c.mainCat===filterCat)
    .filter(c=>!chSearch||c.name.includes(chSearch));

  const selectedCards = selectedCh ? cards.filter(c=>c.channel===selectedCh) : [];
  const mainCats = Object.keys(TAXONOMY);
  const getYtUrl = ch => {
    const card = cards.find(c=>c.channel===ch.name&&c.channelUrl);
    if (card?.channelUrl) return card.channelUrl;
    // channelUrl 없으면 YouTube 검색으로
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(ch.name)}+채널`;
  };

  // ── 채널 상세 뷰 ──
  if (selectedCh) {
    const ch = channels.find(c=>c.name===selectedCh);
    const bulkSubs = (TAXONOMY[bulkMainCat]?.subs||[]).filter(s=>s!=="전체");
    return (
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button onClick={()=>{setSelectedCh(null);setEditingCh(null);setBulkMainCat("전체");setBulkSubCats([]);}} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm">←</button>
          {ch?.thumbnail&&<img src={ch.thumbnail} className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-gray-900 truncate">{selectedCh}</h2>
            <p className="text-xs text-gray-400">{selectedCards.length}개 소재</p>
          </div>
          <a href={getYtUrl(ch)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0" style={{background:"#ff0000"}}>
            ▶ YouTube
          </a>
          <button onClick={()=>setEditingCh(editingCh===selectedCh?null:selectedCh)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex-shrink-0">
            📂 카테고리 일괄 변경
          </button>
        </div>

        {/* 카테고리 일괄 변경 패널 */}
        {editingCh===selectedCh&&(
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm space-y-3">
            <p className="text-xs font-black text-gray-700">"{selectedCh}" 채널 카드 {selectedCards.length}개 전체 카테고리 변경</p>
            <div>
              <p className="text-xs text-gray-400 mb-2">대분류 선택</p>
              <div className="flex flex-wrap gap-1.5">
                {mainCats.filter(c=>c!=="전체").map(c=>(
                  <button key={c} onClick={()=>{setBulkMainCat(c);setBulkSubCats([]);}}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all"
                    style={bulkMainCat===c?{backgroundColor:TAXONOMY[c]?.color,color:"white"}:{backgroundColor:"#f3f4f6",color:"#6b7280"}}>
                    {TAXONOMY[c]?.emoji} {c}
                  </button>
                ))}
              </div>
            </div>
            {bulkSubs.length>0&&(
              <div>
                <p className="text-xs text-gray-400 mb-2">소분류 선택 <span className="text-gray-300">(여러 개 가능)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {bulkSubs.map(s=>{
                    const active = bulkSubCats.includes(s);
                    return (
                      <button key={s} onClick={()=>toggleBulkSub(s)}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all border"
                        style={active?{backgroundColor:TAXONOMY[bulkMainCat]?.color,color:"white",borderColor:"transparent"}:{backgroundColor:"#f3f4f6",color:"#6b7280",borderColor:"#e5e7eb"}}>
                        {active&&"✓ "}{s}
                      </button>
                    );
                  })}
                </div>
                {bulkSubCats.length>0&&<p className="text-xs text-gray-400 mt-1">선택: {bulkSubCats.join(", ")}</p>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={()=>{
                  if (bulkMainCat==="전체") { alert("대분류를 먼저 선택해주세요"); return; }
                  onBulkCatChange(selectedCh, bulkMainCat, bulkSubCats);
                  setEditingCh(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black text-gray-900" style={{background:"#FF8C00"}}>
                ✅ "{selectedCh}" {selectedCards.length}개 카드에만 적용
              </button>
              <button onClick={()=>setEditingCh(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100">취소</button>
            </div>
          </div>
        )}

        <div className="grid gap-3" style={{gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",alignItems:"start"}}>
          {selectedCards.map(card=>{
            const color = TAXONOMY[card.mainCat]?.color||"#888";
            const subs  = Array.isArray(card.subCat)?card.subCat:(card.subCat&&card.subCat!=="전체"?[card.subCat]:[]);
            return (
              <a key={card.id} href={card.url} target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer block">
                <div className="relative" style={{height:"130px"}}>
                  <img src={card.thumbnail} className="w-full h-full object-cover"/>
                  <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs font-black px-1.5 py-0.5 rounded-lg">{card.multiplier}</div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                    <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold text-gray-900 line-clamp-2 mb-1.5" style={{minHeight:"2rem"}}>{card.title}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{backgroundColor:color+"20",color}}>{TAXONOMY[card.mainCat]?.emoji} {card.mainCat}</span>
                    {subs.map(s=><span key={s} className="text-xs px-1.5 py-0.5 rounded-full" style={{backgroundColor:color+"10",color,border:`1px solid ${color}30`}}>{s}</span>)}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 채널 목록 뷰 ──
  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">

      {/* 미니 대시보드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-black text-gray-500 mb-3">카테고리별 채널 현황</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          <div className="text-center p-2 bg-gray-50 rounded-xl">
            <p className="text-lg font-black text-gray-900">{channels.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">전체</p>
          </div>
          {Object.entries(catStats).sort((a,b)=>b[1]-a[1]).map(([cat,cnt])=>{
            const color = TAXONOMY[cat]?.color||"#888";
            return (
              <div key={cat} className="text-center p-2 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                style={{backgroundColor:color+"15"}} onClick={()=>setFilterCat(filterCat===cat?"전체":cat)}>
                <p className="text-lg font-black" style={{color}}>{cnt}</p>
                <p className="text-xs mt-0.5 font-medium truncate" style={{color}}>{TAXONOMY[cat]?.emoji} {cat}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 검색 + 카테고리 필터 탭 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={chSearch} onChange={e=>setChSearch(e.target.value)}
          placeholder="채널 검색..."
          className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-2xl px-4 py-2.5 outline-none focus:border-gray-300"/>
        <span className="text-xs text-gray-400 font-medium flex-shrink-0">{filtered.length}개 채널</span>
      </div>

      {/* 카테고리 필터 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={()=>setFilterCat("전체")}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={filterCat==="전체"?{backgroundColor:"#374151",color:"white"}:{backgroundColor:"#f3f4f6",color:"#6b7280"}}>
          🎯 전체 {channels.length}
        </button>
        {Object.entries(catStats).sort((a,b)=>b[1]-a[1]).map(([cat,cnt])=>{
          const color = TAXONOMY[cat]?.color||"#888";
          return (
            <button key={cat} onClick={()=>setFilterCat(filterCat===cat?"전체":cat)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={filterCat===cat?{backgroundColor:color,color:"white"}:{backgroundColor:"#f3f4f6",color:"#6b7280"}}>
              {TAXONOMY[cat]?.emoji} {cat} {cnt}
            </button>
          );
        })}
      </div>

      {/* 채널 카드 목록 */}
      {filtered.length===0?(
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <span className="text-5xl mb-4">📡</span>
          <p className="font-bold text-lg text-gray-400">채널이 없어요</p>
          <p className="text-sm text-gray-300 mt-1">📡 채널 수집으로 영상을 추가해보세요</p>
        </div>
      ):(
        <div className="grid gap-4" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",alignItems:"start"}}>
          {filtered.map(ch=>{
            const color = TAXONOMY[ch.mainCat]?.color||"#888";
            return (
              <div key={ch.name} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={()=>selectChannel(ch.name)}>
                <div className="relative h-20 bg-gray-100 overflow-hidden">
                  {ch.thumbnail&&<img src={ch.thumbnail} className="w-full h-full object-cover opacity-50"/>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
                  <a href={getYtUrl(ch)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                    className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-white text-xs"
                    style={{background:"#ff0000"}}>▶</a>
                </div>
                <div className="p-3">
                  <p className="text-sm font-black text-gray-900 truncate mb-1.5">{ch.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{backgroundColor:color+"20",color}}>
                      {TAXONOMY[ch.mainCat]?.emoji} {ch.mainCat}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{ch.count}개</span>
                  </div>
                  {Object.keys(ch.cats).length>1&&(
                    <div className="flex gap-0.5 mt-2 rounded-full overflow-hidden h-1.5">
                      {Object.entries(ch.cats).sort((a,b)=>b[1]-a[1]).map(([cat,cnt])=>(
                        <div key={cat} style={{flex:cnt,backgroundColor:TAXONOMY[cat]?.color||"#ddd"}} title={`${cat}: ${cnt}개`}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
const MyChannelTab = ({ refCards, apiKey, geminiKey }) => {
  const [myChannels, setMyChannels] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("my_channels")||"[]"); } catch { return []; }
  });

  const [selectedChId, setSelectedChId] = useState("all");
  const [dateFrom, setDateFrom] = useState(()=>{ const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10); });
  const [dateTo, setDateTo]     = useState(()=>new Date().toISOString().slice(0,10));
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl]     = useState("");
  const [addCat, setAddCat]     = useState("전체");
  const [adding, setAdding]     = useState(false);
  const [addError, setAddError] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [geminiDiag, setGeminiDiag] = useState("");
  const [diagLoading, setDiagLoading] = useState(false);
  const [csvData, setCsvData] = useState(""); // YouTube Studio CSV 데이터

  const mainCats = Object.keys(TAXONOMY);
  const saveChannels = list => { setMyChannels(list); localStorage.setItem("my_channels", JSON.stringify(list)); };

  const extractChannelId = async (url) => {
    const cleanUrl = url.split("?")[0].trim();
    const idMatch = cleanUrl.match(/channel\/(UC[\w-]+)/); if (idMatch) return idMatch[1];
    const directId = cleanUrl.match(/(UC[\w-]{22})/); if (directId) return directId[1];
    const handleMatch = cleanUrl.match(/@([\w.-]+)/);
    if (handleMatch) {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handleMatch[1]}&key=${apiKey}`);
      const data = await res.json();
      return data.items?.[0]?.id?.channelId||null;
    }
    return null;
  };

  const addChannel = async () => {
    if (!addUrl.trim()) return;
    if (!apiKey||!apiKey.startsWith("AIza")) { setAddError("API 키를 ⚙️ 설정에서 먼저 등록해주세요"); return; }
    setAdding(true); setAddError("");
    try {
      const channelId = await extractChannelId(addUrl);
      if (!channelId) { setAddError("채널을 찾을 수 없어요."); setAdding(false); return; }
      if (myChannels.find(c=>c.id===channelId)) { setAddError("이미 등록된 채널이에요."); setAdding(false); return; }
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
      const chData = await chRes.json();
      const chInfo = chData.items?.[0];
      if (!chInfo) { setAddError("채널 정보를 가져올 수 없어요."); setAdding(false); return; }
      saveChannels([...myChannels, { id:channelId, name:chInfo.snippet.title, thumbnail:chInfo.snippet.thumbnails?.medium?.url||"", subscribers:parseInt(chInfo.statistics?.subscriberCount||0), url:addUrl, category:addCat, addedAt:Date.now() }]);
      setAddUrl(""); setAddCat("전체"); setShowAddForm(false);
    } catch(e) { setAddError("등록 중 오류가 발생했어요."); }
    setAdding(false);
  };

  const removeChannel = id => { saveChannels(myChannels.filter(c=>c.id!==id)); if(selectedChId===id) setSelectedChId("all"); };

  const runSearch = async () => {
    if (!apiKey||!apiKey.startsWith("AIza")) { setSearchError("API 키를 ⚙️ 설정에서 먼저 등록해주세요"); return; }
    setSearchError(""); setActiveData(null); setGeminiDiag("");
    const targets = selectedChId==="all" ? myChannels : myChannels.filter(c=>c.id===selectedChId);
    if (!targets.length) { setSearchError("채널을 먼저 등록해주세요"); return; }
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs   = dateTo   ? new Date(dateTo+"T23:59:59").getTime() : Date.now();
    setLoadingId("search");
    try {
      const results = [];
      for (const ch of targets) {
        const srRes  = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.id}&type=video&order=date&maxResults=50&key=${apiKey}`);
        const srData = await srRes.json();
        if (srData.error||!srData.items?.length) continue;
        const videoIds = srData.items.map(i=>i.id.videoId).filter(Boolean).join(",");
        const vidRes  = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`);
        const vidData = await vidRes.json();
        const videos  = (vidData.items||[]).filter(v=>{ const ts=new Date(v.snippet.publishedAt).getTime(); return ts>=fromTs&&ts<=toTs; });
        if (!videos.length) continue;
        const avgViews = videos.reduce((s,v)=>s+parseInt(v.statistics?.viewCount||0),0)/videos.length;
        const filteredRef = ch.category==="전체" ? refCards : refCards.filter(c=>c.mainCat===ch.category);
        const refAvgMulti = filteredRef.length ? filteredRef.reduce((s,c)=>s+parseFloat(c.multiplier?.replace("×","")||0),0)/filteredRef.length : 0;
        const top5 = [...videos].sort((a,b)=>parseInt(b.statistics?.viewCount||0)-parseInt(a.statistics?.viewCount||0)).slice(0,5)
          .map(v=>({ title:v.snippet.title, views:parseInt(v.statistics?.viewCount||0), thumbnail:v.snippet.thumbnails?.medium?.url||"", url:`https://youtube.com/watch?v=${v.id}`, publishedAt:v.snippet.publishedAt }));
        // 조회수 분포
        const allViews = videos.map(v=>parseInt(v.statistics?.viewCount||0)).sort((a,b)=>a-b);
        results.push({ ch, avgViews:Math.round(avgViews), videoCount:videos.length, refAvgMulti:refAvgMulti.toFixed(1), refCount:filteredRef.length, goalViews:Math.round(avgViews*20), top5, allViews, filteredRef });
      }
      setActiveData(results);
    } catch(e) { setSearchError("검색 중 오류가 발생했어요."); }
    setLoadingId(null);
  };

  const runGeminiDiag = async (result) => {
    if (!geminiKey||!geminiKey.startsWith("AIza")) { setGeminiDiag("⚙️ 설정에서 Gemini API 키를 먼저 등록해주세요"); return; }
    setDiagLoading(true); setGeminiDiag("");
    const myTop5Titles  = result.top5.map((v,i)=>`${i+1}. "${v.title}" (${fmtNum(v.views)}회)`).join("\n");
    const refTop5Titles = [...result.filteredRef].sort((a,b)=>parseFloat(b.multiplier?.replace("×","")||0)-parseFloat(a.multiplier?.replace("×","")||0)).slice(0,5)
      .map((v,i)=>`${i+1}. "${v.title}" (×${v.multiplier?.replace("×","")||"?"}, ${v.views}회)`).join("\n");
    const csvSection = csvData ? `\n\n【YouTube Studio 실제 데이터 (CSV)】\n${csvData.slice(0,3000)}` : "";
    const prompt = `당신은 유튜브 쇼츠 전략가입니다. 아래 데이터를 분석해서 실용적인 피드백을 주세요.

【내 채널: ${result.ch.name}】
- 기간 내 평균 조회수: ${fmtNum(result.avgViews)}
- 분석 영상 수: ${result.videoCount}개
- 인기 영상 TOP5 제목:
${myTop5Titles}${csvSection}

【레퍼런스 채널 (${result.ch.category} 카테고리) TOP5】
- 레퍼런스 평균 배수: ×${result.refAvgMulti}
- 레퍼런스 인기 영상:
${refTop5Titles}

다음 형식으로 분석해주세요:
1. 📌 핵심 차이점 (제목 패턴, 소재 선택 등)
2. ⚠️ 내 채널의 약점 2~3가지
3. ✅ 레퍼런스에서 훔쳐야 할 패턴 3가지
4. 💡 당장 써먹을 수 있는 제목 공식 3개 예시`;

    try {
      const res = await fetch("/api/gemini", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ key:geminiKey, prompt }) });
      const data = await res.json();
      setGeminiDiag(data.result || data.error || "응답 없음");
    } catch(e) { setGeminiDiag("오류: "+e.message); }
    setDiagLoading(false);
  };

  const fmtNum = n => n>=10000000?`${(n/10000000).toFixed(1)}천만`:n>=1000000?`${(n/1000000).toFixed(0)}백만`:n>=10000?`${Math.round(n/10000)}만`:n>=1000?`${(n/1000).toFixed(1)}천`:`${n}`;
  const fmtDate = s => s ? new Date(s).toLocaleDateString("ko",{month:"short",day:"numeric"}) : "";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* 검색 바 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[200px]">
            <select value={selectedChId} onChange={e=>setSelectedChId(e.target.value)}
              className="w-full appearance-none border-2 border-blue-400 rounded-2xl pl-9 pr-8 py-2.5 text-sm font-bold text-gray-800 outline-none bg-white cursor-pointer">
              <option value="all">전체 채널</option>
              {myChannels.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
              <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 text-xs text-gray-400 bg-white px-1">시작일</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-2xl px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="text-sm font-medium text-gray-700 outline-none bg-transparent w-32"/>
            </div>
          </div>
          <span className="text-gray-400 font-bold">-</span>
          <div className="relative">
            <label className="absolute -top-2 left-3 text-xs text-gray-400 bg-white px-1">종료일</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-2xl px-3 py-2.5">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="text-sm font-medium text-gray-700 outline-none bg-transparent w-32"/>
            </div>
          </div>
          <button onClick={runSearch} disabled={loadingId==="search"}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-blue-400 rounded-2xl text-sm font-bold text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40">
            {loadingId==="search"?<div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin"/>:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
            검색
          </button>
          <button onClick={()=>setShowAddForm(s=>!s)} className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-700">+ 채널 추가</button>
        </div>
        {searchError&&<p className="text-xs text-red-500 mt-2 ml-1">⚠️ {searchError}</p>}
      </div>

      {/* 채널 추가 폼 */}
      {showAddForm&&(
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-sm font-black text-gray-900 mb-3">채널 등록</h3>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-400 block mb-1">채널 URL</label>
              <input value={addUrl} onChange={e=>setAddUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addChannel()} placeholder="youtube.com/@채널명" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400"/>
            </div>
            <div className="w-44">
              <label className="text-xs text-gray-400 block mb-1">비교 카테고리</label>
              <select value={addCat} onChange={e=>setAddCat(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                {mainCats.map(c=><option key={c} value={c}>{TAXONOMY[c]?.emoji} {c}</option>)}
              </select>
            </div>
            <button onClick={addChannel} disabled={adding||!addUrl.trim()} className="px-4 py-2.5 rounded-xl text-sm font-black text-gray-900 disabled:opacity-40" style={{background:"#FF8C00"}}>{adding?"등록 중...":"등록"}</button>
            <button onClick={()=>{setShowAddForm(false);setAddError("");}} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100">취소</button>
          </div>
          {addError&&<p className="text-xs text-red-500 mt-2">⚠️ {addError}</p>}
        </div>
      )}

      {/* 등록된 채널 태그 */}
      {myChannels.length>0&&(
        <div className="flex gap-2 flex-wrap">
          {myChannels.map(ch=>(
            <div key={ch.id} className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm border border-gray-100">
              <img src={ch.thumbnail} className="w-7 h-7 rounded-full object-cover flex-shrink-0"/>
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-900 truncate max-w-[100px]">{ch.name}</p>
                {ch.category!=="전체"&&<span className="text-xs font-bold" style={{color:TAXONOMY[ch.category]?.color||"#888"}}>{ch.category}</span>}
              </div>
              <button onClick={()=>removeChannel(ch.id)} className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-500 text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!activeData&&loadingId!=="search"&&(
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <span className="text-5xl mb-4">🔍</span>
          <p className="font-bold text-lg text-gray-400">채널을 선택하고 검색해보세요</p>
          <p className="text-sm text-gray-300 mt-1">기간 설정 후 검색하면 레퍼런스와 비교해드려요</p>
        </div>
      )}

      {/* 로딩 */}
      {loadingId==="search"&&(
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-gray-100 border-t-gray-500 animate-spin"/>
          <p className="text-sm font-medium text-gray-400">채널 데이터 분석 중...</p>
        </div>
      )}

      {/* 분석 결과 */}
      {activeData&&activeData.map((result, ri)=>{
        const {ch, avgViews, videoCount, refAvgMulti, refCount, goalViews, top5, allViews, filteredRef} = result;
        const refTop5 = [...filteredRef].sort((a,b)=>parseFloat(b.multiplier?.replace("×","")||0)-parseFloat(a.multiplier?.replace("×","")||0)).slice(0,5);
        const maxMyViews  = Math.max(...top5.map(v=>v.views), 1);
        const maxRefViews = Math.max(...refTop5.map(v=>parseInt(v.views?.replace(/[^0-9]/g,"")||0)), 1);
        return (
          <div key={ri} className="space-y-4">
            {/* 채널 헤더 + 요약 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <img src={ch.thumbnail} className="w-12 h-12 rounded-full object-cover"/>
                <div className="flex-1">
                  <h3 className="text-base font-black text-gray-900">{ch.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {ch.category!=="전체"&&<span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{backgroundColor:(TAXONOMY[ch.category]?.color||"#888")+"20",color:TAXONOMY[ch.category]?.color||"#888"}}>{ch.category} 비교</span>}
                    <span className="text-xs text-gray-400">{fmtDate(dateFrom)} ~ {fmtDate(dateTo)} · {videoCount}개 영상</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"기간 내 평균 조회수", value:fmtNum(avgViews), sub:`${videoCount}개 영상 기준`},
                  {label:"레퍼런스 평균 배수",  value:`×${refAvgMulti}`, sub:`${refCount}개 레퍼런스`},
                  {label:"×20 목표 조회수",     value:fmtNum(goalViews), sub:"현재 평균 기준"},
                ].map(s=>(
                  <div key={s.label} className="bg-gray-50 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-500 font-bold mb-1">{s.label}</p>
                    <p className="text-xl font-black text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 내 채널 TOP5 vs 레퍼런스 TOP5 나란히 비교 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 mb-4">📊 TOP5 제목 패턴 비교</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* 내 채널 */}
                <div>
                  <p className="text-xs font-black text-gray-500 mb-2">🎬 내 채널 인기 TOP5</p>
                  <div className="space-y-2">
                    {top5.map((v,i)=>(
                      <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                          <span className={`text-xs font-black w-4 flex-shrink-0 ${i<3?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600">{v.title}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="h-1.5 rounded-full bg-blue-400 transition-all" style={{width:`${(v.views/maxMyViews)*100}%`, minWidth:"8px", maxWidth:"100%"}}/>
                              <span className="text-xs text-gray-400 flex-shrink-0">{fmtNum(v.views)}</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
                {/* 레퍼런스 */}
                <div>
                  <p className="text-xs font-black text-gray-500 mb-2">⭐ 레퍼런스 배수 TOP5</p>
                  <div className="space-y-2">
                    {refTop5.length>0 ? refTop5.map((v,i)=>{
                      const rv = parseInt(v.views?.replace(/[^0-9]/g,"")||0);
                      return (
                        <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="block group">
                          <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                            <span className={`text-xs font-black w-4 flex-shrink-0 ${i<3?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600">{v.title}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <div className="h-1.5 rounded-full bg-green-400" style={{width:`${Math.min((rv/maxRefViews)*100,100)}%`, minWidth:"8px"}}/>
                                <span className="text-xs text-gray-400 flex-shrink-0">{v.multiplier} · {v.views}</span>
                              </div>
                            </div>
                          </div>
                        </a>
                      );
                    }) : <p className="text-xs text-gray-400 p-2">레퍼런스 카드를 먼저 수집해주세요</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* 레퍼런스 키워드 분석 - 전체 너비 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 mb-3">🔑 레퍼런스 키워드 TOP15</h3>
              {(()=>{
                const stopWords = new Set(['이','그','저','것','수','등','및','또','더','때','에서','으로','에게','부터','까지','이다','있다','하다','되다','않다','없다','같다','보다','대해','대한','위해','위한','통해','관한','한다','된다','있는','없는','하는','되는','않는','같은','보는','다는','는데','에는','으로는','이런','저런','어떤','무슨','얼마','왜','어디','누가','몇','아주','매우','너무','정말','진짜','완전','계속','다시','이미','아직','가장','제일','모든','각','여러','많은','적은','큰','작은','좋은','나쁜','새로운','오래된','빠른','느린','하고','하면','하지','하는데','그리고','하지만','그래서','그런데','때문에','그것','이것','저것','했던','있던','없던','됐던','않았','시즌','season','ep','dp','part','vol','편','화','회','번','번째','the','and','in','of','is','to','a','for','이유','때문','경우','정도','모습','생각','사람','사실','오늘','어제','내일']);
                const wordCount = {};
                filteredRef.slice(0,50).forEach(v=>{
                  const words = v.title
                    .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g,' ')
                    .split(/\s+/)
                    .filter(w=>{
                      if (w.length < 2) return false;
                      if (/^[a-zA-Z0-9]+$/.test(w) && w.length <= 3) return false;
                      if (stopWords.has(w.toLowerCase())) return false;
                      if (/^\d+$/.test(w)) return false;
                      return true;
                    });
                  words.forEach(w=>{ wordCount[w]=(wordCount[w]||0)+1; });
                });
                const display = Object.entries(wordCount).filter(([,cnt])=>cnt>=2).sort((a,b)=>b[1]-a[1]).slice(0,15);
                const fallback = Object.entries(wordCount).sort((a,b)=>b[1]-a[1]).slice(0,15);
                const final = display.length >= 3 ? display : fallback;
                if (final.length === 0) return <p className="text-xs text-gray-400">레퍼런스 카드를 더 수집해주세요 (최소 10개 이상 권장)</p>;
                const maxW = final[0]?.[1]||1;
                return (
                  <div className="flex flex-wrap gap-2">
                    {final.map(([word, cnt])=>{
                      const ratio = cnt/maxW;
                      const size = 11 + Math.round(ratio*6);
                      return (
                        <span key={word} className="px-3 py-1.5 rounded-full font-bold text-white cursor-default"
                          style={{backgroundColor:`rgba(99,102,241,${0.35+ratio*0.65})`, fontSize:`${size}px`}}
                          title={`${cnt}회 등장`}>
                          {word}
                          <span className="ml-1 opacity-60" style={{fontSize:'9px'}}>{cnt}</span>
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Gemini AI 진단 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-900">✨ Gemini AI 채널 진단</h3>
                <button onClick={()=>runGeminiDiag(result)} disabled={diagLoading}
                  className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl disabled:opacity-40"
                  style={{background:"linear-gradient(135deg,#4285f4,#34a853)",color:"white"}}>
                  {diagLoading?<><div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin"/><span>분석 중...</span></>:<span>🔍 진단 시작</span>}
                </button>
              </div>

              {/* CSV 업로드 */}
              <div className="bg-blue-50 rounded-2xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-black text-blue-700">📊 YouTube Studio CSV 업로드 (선택)</span>
                  {csvData&&<span className="text-xs text-green-600 font-bold">✓ 업로드됨</span>}
                </div>
                <p className="text-xs text-blue-500 mb-2">YouTube Studio → 분석 → 콘텐츠 → 내보내기(↓) → CSV 파일 업로드하면 더 정밀한 진단이 가능해요</p>
                <div className="flex items-center gap-2">
                  <input type="file" accept=".csv" onChange={e=>{
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setCsvData(ev.target.result);
                    reader.readAsText(file, 'UTF-8');
                  }} className="text-xs text-blue-600 file:mr-2 file:px-3 file:py-1 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"/>
                  {csvData&&<button onClick={()=>setCsvData("")} className="text-xs text-red-400 hover:text-red-600">제거</button>}
                </div>
              </div>

              {!geminiDiag&&!diagLoading&&(
                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-400">버튼을 눌러 Gemini가 내 채널과 레퍼런스를 비교 분석해드려요</p>
                  <p className="text-xs text-gray-300 mt-1">제목 패턴 · 약점 · 훔쳐야 할 패턴 · 제목 공식</p>
                </div>
              )}
              {geminiDiag&&(
                <div className="bg-gray-50 rounded-2xl p-4">
                  <pre className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">{geminiDiag}</pre>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {activeData&&activeData.length===0&&loadingId!=="search"&&(
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-4xl mb-3">📭</span>
          <p className="font-bold">해당 기간에 업로드된 영상이 없어요</p>
        </div>
      )}
    </div>
  );
};

const ANALYSIS_MODES = [
  { value:"hook",   label:"🎣 훅 패턴 분석",    desc:"제목/첫 문장의 공통 훅 구조 추출" },
  { value:"script", label:"📄 대본 구조 분석",   desc:"스토리 흐름, 문장 패턴 분석" },
  { value:"topic",  label:"🔥 소재 트렌드 분석", desc:"왜 이 소재가 떡상했는지 분석" },
  { value:"custom", label:"✏️ 직접 질문",        desc:"원하는 걸 직접 물어보기" },
];
const AiAnalysisModal = ({ items, onClose, geminiKey }) => {
  const [mode, setMode]     = useState("hook");
  const [customQ, setCustomQ] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyze = async () => {
    if (mode==="custom"&&!customQ.trim()) return;
    if (!geminiKey||!geminiKey.startsWith("AIza")) { setResult("⚙️ 설정에서 Gemini API 키를 먼저 등록해주세요"); return; }
    setLoading(true); setResult("");
    try {
      const cards = items.map((item,i)=>{
        const parts=[`[영상 ${i+1}]`,`제목: ${item.title}`,`채널: ${item.channel}`,`조회수: ${item.views}`,`배수: ${item.multiplier}`,`카테고리: ${item.mainCat}>${item.subCat||""}`];
        if (item.script) parts.push(`대본:\n${item.script}`);
        if (item.memo)   parts.push(`메모: ${item.memo}`);
        return parts.join("\n");
      }).join("\n\n---\n\n");
      const prompts = {
        hook:`다음 유튜브 쇼츠 영상들의 훅 패턴을 분석해주세요.\n1. 제목 구조 패턴\n2. 심리적 트리거\n3. 강력한 훅 요소 TOP3\n4. 바로 써먹을 제목 공식 3개 제안\n\n${cards}`,
        script:`다음 유튜브 쇼츠 대본들의 구조를 분석해주세요.\n1. 스토리 흐름 패턴\n2. 자주 쓰는 연결어/전환어\n3. 문장 길이와 호흡 패턴\n4. 클라이맥스 배치 위치\n5. 대본 작성 팁\n\n${cards}`,
        topic:`다음 유튜브 쇼츠 영상들이 왜 떡상했는지 소재 측면에서 분석해주세요.\n1. 공통 소재 특성\n2. 타겟 심리 분석\n3. 트렌드와의 연결고리\n4. 유사 소재 5개 제안\n\n${cards}`,
        custom:`${customQ}\n\n영상 데이터:\n\n${cards}`,
      };
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: geminiKey, prompt: prompts[mode] })
      });
      const data = await res.json();
      setResult(data.result || data.error || "응답을 받지 못했어요.");
    } catch(e) { setResult("❌ 오류가 발생했어요. 다시 시도해주세요."); }
    setLoading(false);
  };

  const copy = ()=>{navigator.clipboard.writeText(result);setCopied(true);setTimeout(()=>setCopied(false),1500);};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
                <span className="text-white text-sm">✨</span>
              </div>
              <h2 className="text-base font-black text-gray-900">AI 소재 분석</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
          <p className="text-xs text-gray-400 ml-9">선택된 영상 <span className="font-bold text-gray-700">{items.length}개</span></p>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {items.map(item=>(
              <div key={item.id} className="flex-shrink-0 flex items-center gap-1.5 bg-gray-50 rounded-xl px-2.5 py-1.5">
                <img src={item.thumbnail||`https://picsum.photos/seed/${item.id}/40/60`} className="w-6 h-9 object-cover rounded-lg"/>
                <div><p className="text-xs font-bold text-gray-800 max-w-[80px] truncate">{item.title}</p><p className="text-xs text-gray-400">{item.multiplier}</p></div>
                {item.script&&<span className="text-blue-400 text-xs">📄</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-2">
            {ANALYSIS_MODES.map(m=>(
              <button key={m.value} onClick={()=>setMode(m.value)}
                className={`text-left p-3 rounded-2xl border-2 transition-all ${mode===m.value?"border-indigo-400 bg-indigo-50":"border-gray-100 hover:border-gray-200 bg-gray-50"}`}>
                <p className={`text-xs font-black mb-0.5 ${mode===m.value?"text-indigo-700":"text-gray-700"}`}>{m.label}</p>
                <p className={`text-xs ${mode===m.value?"text-indigo-500":"text-gray-400"}`}>{m.desc}</p>
              </button>
            ))}
          </div>
          {mode==="custom"&&(
            <textarea value={customQ} onChange={e=>setCustomQ(e.target.value)} rows={2} placeholder="예) 이 중 제일 빠르게 만들 수 있는 소재 순서로 알려줘"
              className="mt-2 w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none"/>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading?(
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin"/>
              <p className="text-sm text-gray-400">Gemini가 분석 중이에요...</p>
            </div>
          ):result?(
            <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans bg-gray-50 rounded-2xl p-4">{result}</pre>
          ):(
            <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
              <span className="text-4xl">✨</span>
              <p className="text-sm font-medium">분석 모드를 선택하고 시작해보세요</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {result&&<button onClick={copy} className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${copied?"bg-green-500 text-white":"bg-gray-100 text-gray-700"}`}>{copied?"✓ 복사됨":"복사"}</button>}
          <button onClick={analyze} disabled={loading||(mode==="custom"&&!customQ.trim())}
            className="flex-1 py-2.5 rounded-2xl text-sm font-black text-white disabled:opacity-40" style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
            {loading?"분석 중...":result?"🔄 다시 분석":"✨ 분석 시작"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 기획안 내보내기 모달
// ─────────────────────────────────────────────
const ExportModal = ({ items, onClose }) => {
  const [copied, setCopied] = useState(false);
  const text = items.map((item,i)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[${i+1}] ${item.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📺 채널: ${item.channel}
👁 조회수: ${item.views}  배수: ${item.multiplier}
🗂 카테고리: ${item.mainCat} > ${item.subCat||"-"}
🕐 업로드: ${getDisplayDate(item)}
🔗 URL: ${item.url}
${item.tags?.length?`🏷 태그: ${item.tags.join(", ")}`:""}
${item.memo?`✏️ 메모: ${item.memo}`:""}
${item.myViews?`📈 내 성과: ${item.myViews}`:""}
${item.script?`\n📄 대본:\n${item.script}`:""}
`).join("\n");

  const copy = ()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const download = ()=>{
    const blob = new Blob([text],{type:"text/plain;charset=utf-8"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`귤박스_기획안_${new Date().toLocaleDateString("ko")}.txt`; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div><h2 className="text-base font-black text-gray-900">📋 기획안 내보내기</h2><p className="text-xs text-gray-400 mt-0.5">{items.length}개 소재</p></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed font-mono bg-gray-50 rounded-2xl p-4">{text}</pre>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={copy} className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${copied?"bg-green-500 text-white":"bg-gray-100 text-gray-700"}`}>{copied?"✓ 복사됨":"📋 복사"}</button>
          <button onClick={download} className="flex-1 py-2.5 rounded-2xl text-sm font-black text-gray-900" style={{background:"#FF8C00"}}>⬇️ 다운로드</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 대시보드 탭
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 분석 탭
// ─────────────────────────────────────────────
const AnalysisTab = ({ cards, geminiKey, onOpenSettings }) => {
  const [selectedCards, setSelectedCards] = useState([]);
  const [customUrl, setCustomUrl]         = useState("");
  const [result, setResult]               = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [history, setHistory]             = useState(()=>{ try{ return JSON.parse(localStorage.getItem("analysis_history")||"[]"); }catch{ return []; } });
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [searchQ, setSearchQ]             = useState("");

  const deleteHistory = (i) => {
    const n = history.filter((_,idx)=>idx!==i);
    setHistory(n); localStorage.setItem("analysis_history", JSON.stringify(n));
  };

  // URL에서 비디오 ID 추출
  const extractVideoId = (url) => url?.match(/(?:v=|shorts\/)([A-Za-z0-9_-]{11})/)?.[1];

  // 자산리스트에서 URL 있는 카드만
  const urlCards = cards.filter(c=>c.url&&extractVideoId(c.url));

  const toggleCard = (card) => {
    setSelectedCards(p=>
      p.find(c=>c.id===card.id) ? p.filter(c=>c.id!==card.id) : [...p, card]
    );
  };

  const analyze = async () => {
    if (!geminiKey||!geminiKey.startsWith("AIza")) {
      setError("⚙️ 설정에서 Gemini API 키를 먼저 등록해주세요"); return;
    }
    const targets = customUrl.trim()
      ? [{ title: customUrl, url: customUrl }]
      : selectedCards;
    if (targets.length === 0) { setError("영상을 선택하거나 URL을 입력해주세요"); return; }

    setLoading(true); setError(""); setResult("");

    try {
      const allResults = [];
      for (const card of targets) {
        const videoUrl = card.url;
        const prompt = [
          `이 유튜브 영상을 직접 보고 아래 형식으로 분석해주세요.`,
          `절대 인사말 없이 바로 본론만 출력하세요.`,
          ``,
          `🎬 작품 정보`,
          `작품명: (드라마/영화/예능 이름)`,
          `회차: (몇 화인지, 파악 가능하면)`,
          `장르: (드라마/영화/예능 등)`,
          ``,
          `📖 줄거리`,
          `이 클립에서 어떤 일이 벌어지는지 기승전결로 5~7문장. 앞뒤 맥락까지 포함해서 쇼츠 나레이션으로 바로 쓸 수 있는 수준으로 작성.`,
          ``,
          `🎯 후킹 요소`,
          `왜 이 영상이 잘 됐는지, 시청자의 어떤 감정을 건드리는지 구체적으로.`,
          ``,
          `💬 하이라이트 대사`,
          `이 영상에서 가장 임팩트 있는 대사 2~3개를 영상에서 들은 그대로 인용.`,
          ``,
          `✏️ 추천 제목 5개`,
          `음슴체 또는 명사형으로 끝낼 것. 등장인물 이름 포함. "~요?" "~나요?" 절대 금지.`,
          `예시처럼: "문동은이 당한 충격적인 학교폭력 실화" / "연진이가 동은한테 저지른 짓 ㄷㄷ"`,
          ``,
          `🎙️ 나레이션 구성`,
          `오프닝 훅 (3초 안에 시청자 잡는 첫 문장):`,
          `본문 나레이션 (이 클립을 쇼츠로 만들 때 쓸 전체 나레이션):`,
          `클로징 (마지막 문장):`,
        ].join("\n");

        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: geminiKey, videoUrl, prompt })
        });
        const data = await res.json();
        if (data.error) { setError(data.error); setLoading(false); return; }
        allResults.push(`🎬 **${card.title||videoUrl}**\n\n${data.result}`);
      }

      const finalResult = allResults.join("\n\n" + "=".repeat(40) + "\n\n");
      setResult(finalResult);

      const newHistory = [{
        title: targets.map(c=>c.title||c.url).join(", "),
        result: finalResult,
        date: new Date().toLocaleDateString("ko")
      }, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem("analysis_history", JSON.stringify(newHistory));
    } catch(e) { setError("오류: "+e.message); }
    setLoading(false);
  };

  const renderResult = (text) => text.split("\n").map((line,i)=>{
    const bold = line.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
    const isSectionHeader = ["🎬","📖","🎯","💬","✏️","🎙️"].some(e=>line.startsWith(e));
    const isDivider = line.trim().startsWith("===");
    const isVideoHeader = line.startsWith("🔗");
    const isLabel = ["작품명:","회차:","장르:","오프닝 훅","본문 나레이션","클로징"].some(l=>line.startsWith(l));
    const isNum = /^[①②③④⑤]/.test(line);
    if (isDivider) return <hr key={i} className="my-6 border-gray-200"/>;
    if (isVideoHeader) return <p key={i} className="text-base font-black text-gray-900 mb-2" dangerouslySetInnerHTML={{__html:bold}}/>;
    if (isSectionHeader) return <p key={i} className="text-base font-black text-gray-900 mt-6 mb-2 pb-1 border-b-2 border-orange-200" dangerouslySetInnerHTML={{__html:bold}}/>;
    if (isLabel) return <p key={i} className="text-sm font-black text-orange-500 mt-2 mb-0.5" dangerouslySetInnerHTML={{__html:bold}}/>;
    if (isNum) return <p key={i} className="text-sm text-gray-800 bg-gray-50 rounded-xl px-3 py-2 mt-1" dangerouslySetInnerHTML={{__html:bold}}/>;
    if (line==="") return <div key={i} className="h-1"/>;
    return <p key={i} className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html:bold}}/>;
  });

  const filtered = urlCards.filter(c=>
    !searchQ || c.title?.includes(searchQ) || c.channel?.includes(searchQ)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-gray-900 mb-1">🔍 영상 분석</h2>
        <p className="text-sm text-gray-400">Gemini가 영상을 직접 보고 클립·제목·대사를 뽑아드려요</p>
      </div>

      {(!geminiKey||!geminiKey.startsWith("AIza"))&&(
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <p className="text-sm font-black text-amber-700">⚙️ Gemini API 키 등록 필요</p>
          <button onClick={onOpenSettings} className="text-xs font-black px-3 py-1.5 rounded-xl text-white" style={{background:"#FF8C00"}}>설정 열기</button>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
        {/* 자산리스트에서 선택 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black text-gray-600">📦 자산리스트에서 선택</label>
            <button onClick={()=>setShowCardPicker(o=>!o)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
              {showCardPicker ? "접기 ▲" : `펼치기 ▼ (${urlCards.length}개)`}
            </button>
          </div>

          {/* 선택된 카드 미리보기 */}
          {selectedCards.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedCards.map(c=>(
                <div key={c.id} className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-1">
                  <img src={c.thumbnail} className="w-8 h-5 object-cover rounded"/>
                  <span className="text-xs font-bold text-orange-700 max-w-24 truncate">{c.title}</span>
                  <button onClick={()=>toggleCard(c)} className="text-orange-400 hover:text-orange-600 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}

          {showCardPicker && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                  placeholder="제목, 채널명 검색..."
                  className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none"/>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">유튜브 URL이 있는 카드가 없어요</p>
                ) : filtered.slice(0,30).map(c=>(
                  <div key={c.id} onClick={()=>toggleCard(c)}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${selectedCards.find(s=>s.id===c.id)?"bg-orange-50":""}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedCards.find(s=>s.id===c.id)?"border-orange-400 bg-orange-400":"border-gray-300"}`}>
                      {selectedCards.find(s=>s.id===c.id)&&<span className="text-white text-xs">✓</span>}
                    </div>
                    <img src={c.thumbnail} className="w-14 h-9 object-cover rounded-lg flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{c.title}</p>
                      <p className="text-xs text-gray-400">{c.channel} · 조회수 {c.views}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-100"/>
          <span className="text-xs text-gray-400 font-bold">또는</span>
          <div className="flex-1 h-px bg-gray-100"/>
        </div>

        {/* 직접 URL 입력 */}
        <div className="mb-4">
          <label className="text-xs font-black text-gray-600 block mb-2">🔗 유튜브 URL 직접 입력</label>
          <input value={customUrl} onChange={e=>setCustomUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-300"/>
        </div>

        {error&&<p className="text-xs text-red-500 mb-3">{error}</p>}

        <button onClick={analyze} disabled={loading||(selectedCards.length===0&&!customUrl.trim())}
          className="w-full py-3.5 rounded-2xl text-sm font-black text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{background:"#FF8C00"}}>
          {loading
            ? <><div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin"/><span>Gemini가 영상 분석 중...</span></>
            : <span>✨ 딸깍 분석 ({selectedCards.length > 0 ? `${selectedCards.length}개 선택` : "URL 입력"})</span>
          }
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">Gemini가 영상을 직접 보고 실제 장면·대사·타임라인을 분석해요</p>
      </div>

      {/* 로딩 */}
      {loading&&(
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-orange-400 animate-spin mx-auto mb-4"/>
          <p className="text-sm font-bold text-gray-500">Gemini가 영상을 직접 보고 있어요...</p>
          <p className="text-xs text-gray-400 mt-1">실제 장면·대사·타임라인 분석 중 (30초~1분 소요)</p>
        </div>
      )}

      {/* 결과 */}
      {result&&!loading&&(
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-black text-gray-900">📋 분석 결과</p>
            <button onClick={()=>{navigator.clipboard.writeText(result);alert("복사됐어요!");}}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600">복사</button>
          </div>
          <div className="space-y-0.5">{renderResult(result)}</div>
        </div>
      )}

      {/* 히스토리 */}
      {history.length>0&&!result&&!loading&&(
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-black text-gray-500 mb-3">📂 최근 분석 기록</p>
          <div className="space-y-2">
            {history.map((h,i)=>(
              <div key={i} className="flex items-center gap-2">
                <button onClick={()=>setResult(h.result)} className="flex-1 text-left flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50">
                  <span className="text-lg">🎬</span>
                  <div><p className="text-sm font-bold text-gray-900 truncate">{h.title}</p><p className="text-xs text-gray-400">{h.date}</p></div>
                </button>
                <button onClick={()=>deleteHistory(i)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ cards, allTags }) => {
  if (cards.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-300">
      <span className="text-5xl mb-4">📊</span>
      <p className="font-bold text-lg text-gray-400">필터 조건에 맞는 카드가 없어요</p>
      <p className="text-sm text-gray-300 mt-1">갤러리에서 기간/카테고리 필터를 바꿔보세요</p>
    </div>
  );
  // 카테고리별 평균 배수
  const catStats = useMemo(()=>{
    const map = {};
    cards.forEach(c=>{
      if (!c.mainCat||c.mainCat==="전체") return;
      if (!map[c.mainCat]) map[c.mainCat]={total:0,count:0,color:TAXONOMY[c.mainCat]?.color||"#888"};
      const m = parseFloat(c.multiplier?.replace("×","")||0);
      if (m>0){map[c.mainCat].total+=m;map[c.mainCat].count++;}
    });
    return Object.entries(map).map(([cat,{total,count,color}])=>({cat,avg:(total/count).toFixed(1),count,color}))
      .sort((a,b)=>parseFloat(b.avg)-parseFloat(a.avg));
  },[cards]);

  // 배수 TOP10
  const top10 = useMemo(()=>[...cards].sort((a,b)=>parseFloat(b.multiplier?.replace("×","")||0)-parseFloat(a.multiplier?.replace("×","")||0)).slice(0,10),[cards]);

  // 채널별 평균 배수
  const channelStats = useMemo(()=>{
    const map = {};
    cards.forEach(c=>{
      if (!c.channel) return;
      if (!map[c.channel]) map[c.channel]={total:0,count:0};
      const m = parseFloat(c.multiplier?.replace("×","")||0);
      if (m>0){map[c.channel].total+=m;map[c.channel].count++;}
    });
    return Object.entries(map).map(([ch,{total,count}])=>({ch,avg:(total/count).toFixed(1),count}))
      .sort((a,b)=>parseFloat(b.avg)-parseFloat(a.avg)).slice(0,8);
  },[cards]);

  // 배수 분포 히스토그램
  const distribution = useMemo(()=>{
    const buckets = [
      {label:"×5 미만",  min:0,  max:5,  color:"#94a3b8"},
      {label:"×5~10",    min:5,  max:10, color:"#60a5fa"},
      {label:"×10~20",   min:10, max:20, color:"#34d399"},
      {label:"×20~30",   min:20, max:30, color:"#f59e0b"},
      {label:"×30 이상", min:30, max:999,color:"#f43f5e"},
    ];
    return buckets.map(b=>({
      ...b,
      count: cards.filter(c=>{ const m=parseFloat(c.multiplier?.replace("×","")||0); return m>=b.min&&m<b.max; }).length
    }));
  },[cards]);

  // 태그별 현황
  const tagStats = useMemo(()=>
    allTags.map(tag=>({ tag, count:cards.filter(c=>c.tags?.includes(tag)).length })).filter(t=>t.count>0)
  ,[cards,allTags]);

  // 카테고리별 수집 수 (파이 대신 비율 바)
  const catCount = useMemo(()=>{
    const map = {};
    cards.forEach(c=>{ if(c.mainCat&&c.mainCat!=="전체") map[c.mainCat]=(map[c.mainCat]||0)+1; });
    return Object.entries(map).map(([cat,count])=>({cat,count,color:TAXONOMY[cat]?.color||"#888",emoji:TAXONOMY[cat]?.emoji||""}))
      .sort((a,b)=>b.count-a.count).slice(0,8);
  },[cards]);

  const maxAvg = Math.max(...catStats.map(s=>parseFloat(s.avg)),1);
  const maxChAvg = Math.max(...channelStats.map(s=>parseFloat(s.avg)),1);
  const maxDist = Math.max(...distribution.map(d=>d.count),1);
  const totalCatCount = catCount.reduce((s,c)=>s+c.count,0)||1;
  const maxMultiplier = parseFloat(top10[0]?.multiplier?.replace("×","")||0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"총 소재 수",  value:`${cards.length}개`,  icon:"🗂", bg:"#f0fdf4" },
          { label:"전체 평균 배수", value:`×${cards.length?((cards.reduce((s,c)=>s+parseFloat(c.multiplier?.replace("×","")||0),0))/cards.length).toFixed(1):"—"}`, icon:"📊", bg:"#eff6ff" },
          { label:"북마크",      value:`${cards.filter(c=>c.bookmarked).length}개`, icon:"★", bg:"#fefce8" },
          { label:"대본 보유",   value:`${cards.filter(c=>c.script).length}개`, icon:"📄", bg:"#faf5ff" },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 text-base" style={{backgroundColor:s.bg}}>{s.icon}</div>
            <p className="text-2xl font-black text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 배수 분포 히스토그램 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 mb-1">📊 배수 분포</h3>
        <p className="text-xs text-gray-400 mb-4">수집된 영상들이 어느 배수 구간에 몰려있는지</p>
        <div className="flex items-end gap-2 h-28">
          {distribution.map(d=>(
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-black text-gray-700">{d.count}</span>
              <div className="w-full rounded-t-xl transition-all duration-700 min-h-[4px]"
                style={{height:`${maxDist>0?(d.count/maxDist)*80:4}px`, backgroundColor:d.color}}/>
              <span className="text-xs text-gray-500 font-medium text-center leading-tight">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 카테고리별 평균 배수 + 수집 비율 나란히 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* 평균 배수 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 mb-1">🎯 카테고리별 평균 배수</h3>
          <p className="text-xs text-gray-400 mb-4">어떤 장르가 알고리즘에 더 유리한지</p>
          {catStats.length===0 ? <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p> : (
            <div className="space-y-3">
              {catStats.map(s=>(
                <div key={s.cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{TAXONOMY[s.cat]?.emoji}</span>
                      <span className="text-xs font-bold text-gray-700">{s.cat}</span>
                      <span className="text-xs text-gray-400">({s.count})</span>
                    </div>
                    <span className="text-xs font-black text-gray-900">×{s.avg}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{width:`${(parseFloat(s.avg)/maxAvg)*100}%`,backgroundColor:s.color}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 수집 비율 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 mb-1">🗂 카테고리별 수집 비율</h3>
          <p className="text-xs text-gray-400 mb-4">어떤 장르를 얼마나 모았는지</p>
          {catCount.length===0 ? <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p> : (
            <div className="space-y-3">
              {catCount.map(s=>(
                <div key={s.cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{s.emoji}</span>
                      <span className="text-xs font-bold text-gray-700">{s.cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{s.count}개</span>
                      <span className="text-xs font-black text-gray-900">{Math.round(s.count/totalCatCount*100)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{width:`${(s.count/totalCatCount)*100}%`,backgroundColor:s.color}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 채널별 평균 배수 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 mb-1">📺 채널별 평균 배수</h3>
        <p className="text-xs text-gray-400 mb-4">어떤 채널이 꾸준히 떡상하는지 — 벤치마킹 우선순위</p>
        {channelStats.length===0 ? <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p> : (
          <div className="grid grid-cols-2 gap-2">
            {channelStats.map((s,i)=>(
              <div key={s.ch} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-2xl">
                <span className={`text-sm font-black w-5 text-center flex-shrink-0 ${i<3?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">@{s.ch}</p>
                  <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${(parseFloat(s.avg)/maxChAvg)*100}%`,background:"#FF8C00"}}/>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-black text-gray-900">×{s.avg}</p>
                  <p className="text-xs text-gray-400">{s.count}개</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 배수 TOP10 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 mb-1">🏆 배수 TOP 10</h3>
        <p className="text-xs text-gray-400 mb-4">수집된 소재 중 가장 떡상한 영상들</p>
        <div className="space-y-2">
          {top10.map((item,i)=>{
            const color = TAXONOMY[item.mainCat]?.color||"#888";
            const pct = maxMultiplier>0?(parseFloat(item.multiplier?.replace("×","")||0)/maxMultiplier)*100:0;
            return (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
                <span className={`text-sm font-black w-6 text-center flex-shrink-0 ${i<3?"text-yellow-500":"text-gray-400"}`}>{i+1}</span>
                <img src={item.thumbnail} className="w-14 h-9 object-cover rounded-xl flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{item.title}</p>
                  <p className="text-xs text-gray-400 mb-1">{item.channel} · {item.views}</p>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,backgroundColor:color}}/>
                  </div>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded-xl flex-shrink-0" style={{backgroundColor:color+"20",color}}>{item.multiplier}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* 태그별 현황 */}
      {tagStats.length>0&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 mb-1">🏷️ 태그별 소재 현황</h3>
          <p className="text-xs text-gray-400 mb-4">급하게 쓸 것 몇 개 남았는지 한눈에</p>
          <div className="flex flex-wrap gap-2">
            {tagStats.map(t=>(
              <div key={t.tag} className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2">
                <span className="text-xs font-bold text-gray-700">{t.tag}</span>
                <span className="text-xs font-black bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 카테고리 수정 모달
const CatEditModal = ({ item, onClose, onSave }) => {
  const [mainCat, setMainCat] = useState(item.mainCat||"전체");
  // subCat을 배열로 관리 (기존 string도 호환)
  const [subCats, setSubCats] = useState(()=>{
    if (!item.subCat||item.subCat==="전체") return [];
    return Array.isArray(item.subCat) ? item.subCat : [item.subCat];
  });
  const mainCats = Object.keys(TAXONOMY);
  const subs     = (TAXONOMY[mainCat]?.subs||[]).filter(s=>s!=="전체");

  const toggleSub = (s) => setSubCats(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">📂 카테고리 수정</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 line-clamp-1 font-medium">{item.title}</p>

          {/* 대분류 */}
          <div>
            <label className="text-xs font-black text-gray-600 block mb-2">대분류 <span className="text-gray-400 font-normal">(1개 선택)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {mainCats.map(c=>(
                <button key={c} onClick={()=>{setMainCat(c);setSubCats([]);}}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all"
                  style={mainCat===c?{backgroundColor:TAXONOMY[c]?.color,color:"white"}:{backgroundColor:"#f3f4f6",color:"#6b7280"}}>
                  {TAXONOMY[c]?.emoji} {c}
                </button>
              ))}
            </div>
          </div>

          {/* 소분류 - 다중 선택 */}
          {subs.length>0&&(
            <div>
              <label className="text-xs font-black text-gray-600 block mb-2">소분류 <span className="text-gray-400 font-normal">(여러 개 선택 가능)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {subs.map(s=>{
                  const active = subCats.includes(s);
                  return (
                    <button key={s} onClick={()=>toggleSub(s)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all border"
                      style={active?{backgroundColor:TAXONOMY[mainCat]?.color,color:"white",borderColor:"transparent"}:{backgroundColor:"#f3f4f6",color:"#6b7280",borderColor:"#e5e7eb"}}>
                      {active&&"✓ "}{s}
                    </button>
                  );
                })}
              </div>
              {subCats.length>0&&(
                <p className="text-xs text-gray-400 mt-1.5">선택됨: {subCats.join(", ")}</p>
              )}
            </div>
          )}

          <button onClick={()=>{onSave(item.id, mainCat, subCats);onClose();}}
            className="w-full py-2.5 rounded-2xl text-sm font-black text-gray-900"
            style={{background:"#FF8C00"}}>저장</button>
        </div>
      </div>
    </div>
  );
};

// 비디오 카드
// ─────────────────────────────────────────────
const VideoCard = ({ item, onSelect, isSelected, onBookmark, onMemo, onScript, onTag, onMyViews, onDelete, onCatEdit, allTags }) => {
  const color = TAXONOMY[item.mainCat]?.color||"#374151";
  const subs = Array.isArray(item.subCat) ? item.subCat : (item.subCat&&item.subCat!=="전체"?[item.subCat]:[]);
  return (
    <div
      className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${isSelected?"scale-[1.02]":"hover:shadow-xl hover:-translate-y-1"}`}
      style={{boxShadow:isSelected?`0 0 0 2.5px ${color}, 0 8px 30px ${color}30`:"0 2px 12px rgba(0,0,0,0.08)"}}
      onClick={()=>onSelect(item.id)}
    >
      <div className="relative overflow-hidden" style={{height:"200px"}}>
        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"/>
        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-white text-xs font-black px-2 py-1 rounded-lg">{item.multiplier||"—"}</div>
        <div className="absolute top-2 right-2 z-10" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onBookmark(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
            style={{backgroundColor:item.bookmarked?"#FBBF24":"rgba(0,0,0,0.4)"}}>
            <span className="text-sm">{item.bookmarked?"★":"☆"}</span>
          </button>
        </div>
        {isSelected&&<div className="absolute top-10 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black" style={{backgroundColor:color}}>✓</div>}
        <div className="absolute bottom-2 right-2 z-10" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>{if(window.confirm("이 카드를 삭제할까요?"))onDelete(item.id);}}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">✕</button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="w-11 h-11 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
          </div>
        </div>
        <div className="absolute bottom-2 left-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg pointer-events-none">{getDisplayDate(item)}</div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1 line-clamp-2" style={{height:"2.5rem",overflow:"hidden"}}>{item.title}</h3>
        <p className="text-xs text-gray-400 mb-2 truncate">@{item.channel}</p>
        <div className="flex items-center gap-1 mb-2 overflow-hidden">
          <button onClick={e=>{e.stopPropagation();onCatEdit(item);}}
            className="text-xs font-bold px-2 py-0.5 rounded-full hover:opacity-70 transition-opacity flex-shrink-0"
            style={{backgroundColor:color+"20",color}}>
            {TAXONOMY[item.mainCat]?.emoji} {item.mainCat}
          </button>
          {subs.slice(0,2).map(s=>(
            <span key={s} className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 max-w-[56px] truncate"
              style={{backgroundColor:color+"10",color,border:`1px solid ${color}30`}}>
              {s}
            </span>
          ))}
          {subs.length>2&&<span className="text-xs text-gray-400 flex-shrink-0">+{subs.length-2}</span>}
          <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            <span className="text-xs font-bold text-gray-700">{item.views||"—"}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 mb-1">
          <a href={item.url||"#"} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
            className="flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold hover:opacity-80 transition-opacity"
            style={{backgroundColor:color+"15",color}}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            원본
          </a>
          <button onClick={e=>{e.stopPropagation();onScript(item);}}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${item.script?"bg-blue-500 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            📄 대본
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button onClick={e=>{e.stopPropagation();onMemo(item);}} className="flex items-center justify-center py-1.5 rounded-xl text-xs bg-gray-100 text-gray-600 hover:bg-gray-200">✏️</button>
          <button onClick={e=>{e.stopPropagation();onTag(item);}} className="flex items-center justify-center py-1.5 rounded-xl text-xs bg-gray-100 text-gray-600 hover:bg-gray-200">🏷️</button>
          <button onClick={e=>{e.stopPropagation();onMyViews(item);}} className={`flex items-center justify-center py-1.5 rounded-xl text-xs transition-colors ${item.myViews?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>📈</button>
        </div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
export default function ZeroClip() {
  const [loggedIn, setLoggedIn]     = useState(()=>sessionStorage.getItem("zc_auth")==="1");
  const [taxVersion, setTaxVersion] = useState(0); // taxonomy 변경 감지용
  const saveTAXONOMY = (t) => { TAXONOMY = t; localStorage.setItem("zc_taxonomy", JSON.stringify(t)); setTaxVersion(v=>v+1); };
  const addCategory    = (name, emoji, color) => { if (!name.trim()||TAXONOMY[name]) return; saveTAXONOMY({...TAXONOMY, [name]:{emoji, color, subs:["전체"]}}); };
  const removeCategory = (name) => { if (name==="전체") return; const t={...TAXONOMY}; delete t[name]; saveTAXONOMY(t); };
  const addSub    = (cat, sub) => { if (!TAXONOMY[cat]||TAXONOMY[cat].subs?.includes(sub)) return; const t={...TAXONOMY,[cat]:{...TAXONOMY[cat],subs:[...(TAXONOMY[cat].subs||["전체"]),sub]}}; saveTAXONOMY(t); };
  const removeSub = (cat, sub) => { const t={...TAXONOMY,[cat]:{...TAXONOMY[cat],subs:(TAXONOMY[cat].subs||[]).filter(s=>s!==sub)}}; saveTAXONOMY(t); };

  const [cards, setCards]           = useState(()=>{
    try { return JSON.parse(localStorage.getItem("zc_cards")||"[]"); } catch { return []; }
  });
  const [tab, setTab]               = useState("gallery");
  const [mainCat, setMainCat]       = useState("전체");
  const [subCat, setSubCat]         = useState("전체");
  const [search, setSearch]         = useState("");
  const [selectedIds, setSelectedIds]= useState([]);
  const [sortBy, setSortBy]         = useState("date");
  const [sortDir, setSortDir]       = useState("asc");
  const [period, setPeriod]         = useState("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [showAdd, setShowAdd]       = useState(false);
  const [memoTarget, setMemoTarget] = useState(null);
  const [scriptTarget, setScriptTarget] = useState(null);
  const [tagTarget, setTagTarget]   = useState(null);
  const [myViewsTarget, setMyViewsTarget] = useState(null);
  const [catEditTarget, setCatEditTarget] = useState(null);
  const saveCat = (id, mainCat, subCat) => setCards(p=>{ const n=p.map(c=>c.id===id?{...c,mainCat,subCat}:c); localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const [aiTargets, setAiTargets]   = useState(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showChannelFetch, setShowChannelFetch]   = useState(false);
  const [showCategoryFetch, setShowCategoryFetch] = useState(false);
  const [showVideoAdd, setShowVideoAdd] = useState(false);
  const [showExport, setShowExport]               = useState(false);
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [activeTag, setActiveTag]   = useState("");
  const [allTags, setAllTags]       = useState(DEFAULT_TAGS);
  const [apiKey, setApiKey]         = useState(()=>localStorage.getItem("yt_api_key")||"");
  const [geminiKey, setGeminiKey]   = useState(()=>localStorage.getItem("gemini_api_key")||"");
  const [openAiKey, setOpenAiKey]   = useState(()=>localStorage.getItem("openai_api_key")||"");
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [lastSynced, setLastSynced]   = useState(()=>localStorage.getItem("zc_last_synced")||"");

  // 등록된 레퍼런스 채널 목록 (자동 업데이트용)
  const [refChannels, setRefChannels] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("zc_ref_channels")||"[]"); } catch { return []; }
  });
  const saveRefChannels = list => { setRefChannels(list); localStorage.setItem("zc_ref_channels", JSON.stringify(list)); };

  // 자동 업데이트: 마지막 동기화 후 6시간 지났으면 자동 실행
  useEffect(()=>{
    if (!apiKey||!apiKey.startsWith("AIza")) return;
    if (refChannels.length===0) return;
    const lastTs = lastSynced ? new Date(lastSynced).getTime() : 0;
    const sixHours = 6*60*60*1000;
    if (Date.now()-lastTs > sixHours) autoSync();
  }, [apiKey]);

  const autoSync = async () => {
    if (!apiKey||!apiKey.startsWith("AIza")||refChannels.length===0) return;
    setAutoSyncing(true);
    let newCount = 0;
    try {
      for (const ch of refChannels) {
        // channelId 확보 - 없으면 URL에서 추출하거나 채널명으로 검색
        let channelId = ch.id;
        if (!channelId && ch.url) {
          channelId = ch.url.match(/channel\/(UC[\w-]+)/)?.[1] || ch.url.match(/(UC[\w-]{22})/)?.[1];
        }
        if (!channelId && ch.url) {
          const handleMatch = ch.url.match(/@([\w.-]+)/);
          if (handleMatch) {
            const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handleMatch[1]}&key=${apiKey}`);
            const searchData = await searchRes.json();
            channelId = searchData.items?.[0]?.id?.channelId;
            // id 업데이트
            if (channelId) saveRefChannels(refChannels.map(r=>r.url===ch.url?{...r,id:channelId}:r));
          }
        }
        if (!channelId) continue;

        const srRes  = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&key=${apiKey}`);
        const srData = await srRes.json();
        if (srData.error||!srData.items?.length) continue;
        const videoIds = srData.items.map(i=>i.id.videoId).filter(Boolean).join(",");
        const vidRes   = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`);
        const vidData  = await vidRes.json();
        const existing = JSON.parse(localStorage.getItem("zc_cards")||"[]");
        const existingUrls = new Set(existing.map(c=>c.url?.split("v=")?.[1]||c.url?.split("shorts/")?.[1]));
        const newCards = (vidData.items||[]).filter(v=>!existingUrls.has(v.id)).map(v=>{
          const views    = parseInt(v.statistics?.viewCount||0);
          const viewsStr = views>=10000000?`${(views/10000000).toFixed(1)}천만`:views>=1000000?`${(views/1000000).toFixed(0)}백만`:views>=10000?`${Math.round(views/10000)}만`:`${views}`;
          const daysDiff = Math.floor((Date.now()-new Date(v.snippet.publishedAt))/86400000);
          const daysAgo  = daysDiff===0?"오늘":daysDiff<=3?`${daysDiff}일 전`:daysDiff<=14?"1주일 전":"1개월 전";
          // 카테고리: 등록된 카테고리 → 기존 카드에서 해당 채널 카테고리 추출 → 전체 순서로 fallback
          const chName = v.snippet.channelTitle;
          const existingCat = existing.filter(c=>c.channel===chName&&c.mainCat&&c.mainCat!=="전체")
            .reduce((acc,c)=>{ acc[c.mainCat]=(acc[c.mainCat]||0)+1; return acc; },{});
          const topCat = Object.entries(existingCat).sort((a,b)=>b[1]-a[1])[0]?.[0];
          const finalCat = (ch.category&&ch.category!=="전체") ? ch.category : (topCat||"전체");
          return { id:Date.now()+Math.random(), title:v.snippet.title, channel:chName, views:viewsStr, multiplier:"×?", mainCat:finalCat, subCat:"", daysAgo, url:`https://youtube.com/watch?v=${v.id}`, channelUrl:ch.url||"", thumbnail:v.snippet.thumbnails?.medium?.url||"", publishedAt:v.snippet?.publishedAt||"", bookmarked:false, memo:"", script:"", tags:[], myViews:"" };
        });
        if (newCards.length>0) {
          newCount += newCards.length;
          setCards(p=>{ const n=[...newCards,...p]; localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
        }
      }
      const now = new Date().toISOString();
      setLastSynced(now); localStorage.setItem("zc_last_synced", now);
      if (newCount > 0) alert(`✅ ${newCount}개 새 영상을 추가했어요!`);
      else alert("새 영상이 없어요. 이미 최신 상태예요!");
    } catch(e) { console.error("autoSync error",e); alert("업데이트 중 오류가 발생했어요."); }
    setAutoSyncing(false);
  };

  const login        = () => { sessionStorage.setItem("zc_auth","1"); setLoggedIn(true); };
  const saveApiKey   = key => { setApiKey(key);    localStorage.setItem("yt_api_key", key); };

  // 기존 카드 날짜 일괄 업데이트
  const fixCardDates = async () => {
    if (!apiKey||!apiKey.startsWith("AIza")) { alert("API 키를 설정에서 먼저 등록해주세요"); return; }
    const missing = cards.filter(c=>!c.publishedAt&&c.url);
    if (missing.length===0) { alert("모든 카드에 날짜 정보가 있어요!"); return; }
    if (!window.confirm(`${missing.length}개 카드의 날짜 정보를 업데이트할게요. (시간이 걸릴 수 있어요)`)) return;

    let updated = 0;
    const CHUNK = 50;
    const allCards = [...cards];

    for (let i=0; i<missing.length; i+=CHUNK) {
      const chunk = missing.slice(i, i+CHUNK);
      const ids = chunk.map(c=>{
        const m = c.url?.match(/(?:v=|shorts\/)([A-Za-z0-9_-]{11})/);
        return m?.[1];
      }).filter(Boolean).join(",");
      if (!ids) continue;
      try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${apiKey}`);
        const data = await res.json();
        data.items?.forEach(v=>{
          const idx = allCards.findIndex(c=>c.url?.includes(v.id));
          if (idx>=0 && v.snippet?.publishedAt) {
            allCards[idx] = {...allCards[idx], publishedAt: v.snippet.publishedAt};
            updated++;
          }
        });
      } catch(e) { console.error(e); }
    }
    setCards(allCards);
    localStorage.setItem("zc_cards", JSON.stringify(allCards));
    alert(`✅ ${updated}개 카드 날짜 업데이트 완료!`);
  };

  // 썸네일 복구
  const fixThumbnails = () => {
    const fixed = cards.map(c=>{
      const videoId = c.url?.match(/(?:v=|shorts\/)([A-Za-z0-9_-]{11})/)?.[1];
      if (!videoId) return c;
      return {...c, thumbnail:`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`};
    });
    setCards(fixed);
    localStorage.setItem("zc_cards", JSON.stringify(fixed));
    alert(`✅ ${fixed.length}개 카드 썸네일 복구 완료!`);
  };

  // 배수 재계산 - 채널 평균 기준
  const recalcMultipliers = () => {
    if (!window.confirm("채널별 평균 조회수를 기준으로 배수를 재계산할게요.")) return;
    // 채널별 평균 조회수 계산
    const chAvg = {};
    const chCards = {};
    cards.forEach(c=>{
      const views = toViewsNum(c.views);
      if (!views) return;
      if (!chCards[c.channel]) chCards[c.channel] = [];
      chCards[c.channel].push(views);
    });
    Object.entries(chCards).forEach(([ch, viewsList])=>{
      chAvg[ch] = viewsList.reduce((a,b)=>a+b,0)/viewsList.length;
    });
    // 배수 재계산
    let updated = 0;
    const fixed = cards.map(c=>{
      const views = toViewsNum(c.views);
      const avg = chAvg[c.channel];
      if (!views || !avg || avg===0) return c;
      const newMulti = `×${(views/avg).toFixed(1)}`;
      if (newMulti !== c.multiplier) updated++;
      return {...c, multiplier: newMulti};
    });
    setCards(fixed);
    localStorage.setItem("zc_cards", JSON.stringify(fixed));
    alert(`✅ ${updated}개 카드 배수 재계산 완료!`);
  };

  const saveGeminiKey= key => { setGeminiKey(key); localStorage.setItem("gemini_api_key", key); };
  const saveOpenAiKey= key => { setOpenAiKey(key); localStorage.setItem("openai_api_key", key); };
  const addTag    = tag => { if (!allTags.includes(tag)) setAllTags(p=>[...p,tag]); };
  const removeTag = tag => { setAllTags(p=>p.filter(t=>t!==tag)); setCards(p=>p.map(c=>({...c,tags:c.tags?.filter(t=>t!==tag)||[]}))); };

  const subs = [];
  const color = TAXONOMY[mainCat]?.color||"#374151";

  const handleMainCat  = cat => { setMainCat(cat); setSubCat("전체"); };
  const toggleSelect   = id  => setSelectedIds(p=>p.includes(id)?p.filter(i=>i!==id):[...p,id]);
  const updateCards    = (newCards) => { setCards(newCards); localStorage.setItem("zc_cards", JSON.stringify(newCards)); };
  const toggleBookmark = id  => setCards(p=>{ const n=p.map(c=>c.id===id?{...c,bookmarked:!c.bookmarked}:c); localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const saveMemo       = (id,memo)   => setCards(p=>{ const n=p.map(c=>c.id===id?{...c,memo}:c);   localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const saveScript     = (id,script) => setCards(p=>{ const n=p.map(c=>c.id===id?{...c,script}:c); localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const saveTags       = (id,tags)   => setCards(p=>{ const n=p.map(c=>c.id===id?{...c,tags}:c);   localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const saveMyViews    = (id,myViews)=> setCards(p=>{ const n=p.map(c=>c.id===id?{...c,myViews}:c);localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const addCard        = card => setCards(p=>{ const n=[card,...p]; localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
  const deleteCard     = id   => setCards(p=>{ const n=p.filter(c=>c.id!==id); localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });

  const filtered = cards
    .filter(item=>{
      if (bookmarkOnly&&!item.bookmarked) return false;
      if (activeTag&&!item.tags?.includes(activeTag)) return false;
      if (mainCat!=="전체"&&item.mainCat!==mainCat) return false;
      if (subCat!=="전체"&&item.subCat!==subCat)  return false;
      if (search&&!item.title.includes(search)&&!item.channel.includes(search)&&!item.subCat?.includes(search)) return false;
      if (!isInPeriod(item,period,customFrom,customTo)) return false;
      return true;
    })
    .sort((a,b)=>{
      const dir=sortDir==="desc"?-1:1;
      if (sortBy==="multiplier") return dir*(parseFloat(b.multiplier?.replace("×","")||0)-parseFloat(a.multiplier?.replace("×","")||0));
      if (sortBy==="views") return dir*(toViewsNum(b.views)-toViewsNum(a.views));
      if (sortBy==="date") return dir*(getCardDays(a)-getCardDays(b));
      if (sortBy==="added") return dir*(new Date(b.addedAt||0)-new Date(a.addedAt||0));
      return 0;
    });

  const bookmarkCount = cards.filter(c=>c.bookmarked).length;

  if (!loggedIn) return <LoginScreen onLogin={login}/>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-0">
          {/* 1행 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center text-lg" style={{background:"#FF8C00"}}>
                🍊
              </div>
              <div className="leading-none">
                <span className="text-sm font-black text-gray-900 tracking-tight">귤</span>
                <span className="text-sm font-black tracking-tight" style={{color:"#FF8C00"}}>박스</span>
              </div>
            </div>

            {tab==="gallery"&&(
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder="검색..." value={search} onChange={e=>setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-xl border-0 outline-none focus:bg-gray-200 transition-colors placeholder-gray-400"/>
              </div>
            )}
            {tab==="dashboard"&&<div className="flex-1"/>}

            {tab==="gallery"&&<>
              <button onClick={()=>setBookmarkOnly(b=>!b)}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex-shrink-0 ${bookmarkOnly?"text-gray-900 border-transparent":"border-gray-200 text-gray-600 bg-white hover:bg-gray-50"}`}
                style={bookmarkOnly?{background:"#FF8C00"}:{}}>
                ★ {bookmarkCount}
              </button>
            </>}

            <button onClick={()=>setShowChannelFetch(true)}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl text-gray-900 hover:opacity-80 transition-all flex-shrink-0"
              style={{background:"#FF8C00"}}>
              📡 채널 수집
            </button>
            <button onClick={()=>setShowVideoAdd(true)}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex-shrink-0">
              🎬 영상 추가
            </button>
            {refChannels.length>0&&(
              <button onClick={autoSync} disabled={autoSyncing}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 flex-shrink-0 disabled:opacity-50">
                {autoSyncing
                  ? <><div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin"/><span>동기화 중...</span></>
                  : <><span>🔄</span><span>새 영상 업데이트</span></>
                }
              </button>
            )}
            <button onClick={()=>setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0 text-sm">⚙️</button>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mb-0">
            {[{key:"gallery",label:"📦 자산리스트"},{key:"gukbap",label:"🍚 국밥리스트"},{key:"analysis",label:"🔍 분석"},{key:"channels",label:"📡 채널"}].map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${tab===t.key?"bg-gray-900 text-white":"text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 대분류/소분류/기간 필터 (갤러리만) - 드롭다운 스타일 */}
          {tab==="gallery"&&(
            <>
              <div className="flex gap-2 py-2 border-t border-gray-100 flex-wrap items-center">
                <CategoryDropdown mainCat={mainCat} onSelect={handleMainCat} cards={cards}/>
                {mainCat!=="전체"&&(TAXONOMY[mainCat]?.subs||[]).filter(s=>s!=="전체").length>0&&(
                  <SubCatDropdown mainCat={mainCat} subCat={subCat} onSelect={setSubCat} cards={cards} color={TAXONOMY[mainCat]?.color}/>
                )}
                <PeriodFilter period={period} setPeriod={setPeriod} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}/>
                <SortFilter sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir}/>
                <div className="flex-1"/>
                <TagFilter allTags={allTags} activeTag={activeTag} setActiveTag={setActiveTag}/>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <span className="text-xs text-gray-400">{filtered.length}개 소재</span>
                {bookmarkOnly&&<span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">★ 북마크만</span>}
                {activeTag&&<span className="text-xs bg-gray-900 text-white font-bold px-2 py-0.5 rounded-full">{activeTag} ✕</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      {tab==="gukbap" ? (
        <GukbapTab/>
      ) : tab==="analysis" ? (
        <AnalysisTab cards={cards} geminiKey={geminiKey} onOpenSettings={()=>setShowSettings(true)}/>
      ) : tab==="channels" ? (
        <ChannelsTab cards={cards} refChannels={refChannels} saveRefChannels={saveRefChannels} onUpdateCards={saveCat} apiKey={apiKey} onBulkCatChange={(chName,mainCat,subCat)=>{
          setCards(p=>{ const n=p.map(c=>c.channel===chName?{...c,mainCat,subCat}:c); localStorage.setItem("zc_cards",JSON.stringify(n)); return n; });
        }} onFilterChannel={ch=>{ setTab("gallery"); setMainCat("전체"); }} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-5">
          {filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <span className="text-5xl mb-4">🔍</span>
              <p className="font-bold text-lg">결과가 없어요</p>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(190px, 1fr))",gap:"16px",alignItems:"start"}}>
              {filtered.map(item=>(
                <VideoCard key={item.id} item={item}
                  onSelect={toggleSelect} isSelected={selectedIds.includes(item.id)}
                  onBookmark={toggleBookmark} onMemo={setMemoTarget} onScript={setScriptTarget}
                  onTag={setTagTarget} onMyViews={setMyViewsTarget} onDelete={deleteCard} onCatEdit={setCatEditTarget} allTags={allTags}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 선택 바 ── */}
      {selectedIds.length>0&&(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl">
            <span className="text-sm font-bold">{selectedIds.length}개</span>
            <button onClick={()=>setAiTargets(cards.filter(c=>selectedIds.includes(c.id)))}
              className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
              ✨ AI 분석
            </button>
            <button onClick={()=>setShowExport(true)} className="text-xs bg-white text-gray-900 font-bold px-3 py-1.5 rounded-xl hover:bg-gray-100">📋 기획안</button>
            <button onClick={()=>setSelectedIds([])} className="text-xs text-gray-400 hover:text-white">취소</button>
          </div>
        </div>
      )}

      {/* ── 모달들 ── */}
      {showAdd          &&<AddCardModal      onClose={()=>setShowAdd(false)}          onAdd={addCard} allTags={allTags}/>}
      {memoTarget       &&<MemoModal         item={memoTarget}   onClose={()=>setMemoTarget(null)}    onSave={saveMemo}/>}
      {scriptTarget     &&<ScriptModal       item={scriptTarget}  onClose={()=>setScriptTarget(null)}  onSave={saveScript} geminiKey={geminiKey}/>}
      {tagTarget        &&<TagModal          item={tagTarget}     onClose={()=>setTagTarget(null)}     onSave={saveTags} allTags={allTags}/>}
      {myViewsTarget    &&<MyViewsModal      item={myViewsTarget} onClose={()=>setMyViewsTarget(null)} onSave={saveMyViews}/>}
      {catEditTarget    &&<CatEditModal      item={catEditTarget} onClose={()=>setCatEditTarget(null)} onSave={saveCat}/>}
      {aiTargets        &&<AiAnalysisModal   items={aiTargets}   onClose={()=>setAiTargets(null)} geminiKey={geminiKey}/>}
      {showExport       &&<ExportModal       items={cards.filter(c=>selectedIds.includes(c.id))} onClose={()=>setShowExport(false)}/>}
      {showSettings     &&<SettingsModal     apiKey={apiKey} onSave={saveApiKey} geminiKey={geminiKey} onSaveGemini={saveGeminiKey} openAiKey={openAiKey} onSaveOpenAi={saveOpenAiKey} onClose={()=>setShowSettings(false)} allTags={allTags} onAddTag={addTag} onRemoveTag={removeTag} taxonomy={TAXONOMY} onAddCategory={addCategory} onRemoveCategory={removeCategory} onAddSub={addSub} onRemoveSub={removeSub} onFixDates={fixCardDates} onFixThumbnails={fixThumbnails} onRecalcMultipliers={recalcMultipliers} onChangePassword={pw=>{localStorage.setItem("zc_password",pw);}}/>}
      {showVideoAdd     &&<VideoAddModal onAdd={addCard} onClose={()=>setShowVideoAdd(false)} apiKey={apiKey}/>}
      {showCategoryFetch&&<CategoryAutoFetchModal apiKey={apiKey} onAdd={addCard} onClose={()=>setShowCategoryFetch(false)}/>}
      {showChannelFetch &&<ChannelFetchModal apiKey={apiKey} onAdd={addCard} onClose={()=>setShowChannelFetch(false)}
        onRegisterChannel={ch=>{ if(!refChannels.find(r=>r.url===ch.url)) saveRefChannels([...refChannels,ch]); }}/>}
    </div>
  );
}
// cache bust Thu Jun  4 02:34:35 UTC 2026
