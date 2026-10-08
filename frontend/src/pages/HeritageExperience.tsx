import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  QrCode,
  Search
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ExtendedHeritageProfile, Language } from "../types";
import { HeritageProfile } from "../types/heritage";
import "./HeritageExperience.css";

const imageInfo = (item?: HeritageProfile | ExtendedHeritageProfile) => {
  if (!item) return { url: "", author: "", source: "", license: "" };
  return {
    url: item.image?.url || "",
    author: item.image?.source || "",
    source: item.image?.source || "",
    license: item.image?.license || ""
  };
};

const imageFor = (item?: HeritageProfile | ExtendedHeritageProfile) => imageInfo(item).url;
const imageAlt = (item?: HeritageProfile | ExtendedHeritageProfile) => `Ảnh tư liệu: ${item?.name || "Đường Sách"}`;

export function HeritageExperience({
  language,
  open,
  heritageList = [],
}: {
  language: Language;
  open: boolean;
  heritageList?: (HeritageProfile | ExtendedHeritageProfile)[];
}) {
  const vi = language === "vi";
  const location = useLocation();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const catalogScroll = useRef(0);
  const [lastHeritagePath, setLastHeritagePath] = useState("/di-san");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  // Retain the outgoing page during the upward transition.
  if (open && lastHeritagePath !== location.pathname)
    setLastHeritagePath(location.pathname);
  const path = open ? location.pathname : lastHeritagePath;
  const id = path.replace(/\/$/, "").split("/")[2];
  const item = id ? heritageList.find((h) => h.id === id) : undefined;
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  const items = heritageList.filter((h) => {
    const textMatch = normalized(
      `${h.name} ${h.nameEn} ${h.province} ${h.code}`,
    ).includes(normalized(query.trim()));
    const categoryMatch =
      category === "all" ||
      (category === "nature"
        ? /Thiên nhiên|Hỗn hợp/.test(h.category)
        : category === "history"
          ? /Quốc gia/.test(h.category)
          : /Văn hóa Thế giới/.test(h.category));
    return textMatch && categoryMatch;
  });

  useLayoutEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (panel.current) {
      panel.current.scrollTop = id ? 0 : catalogScroll.current;
      panel.current
        .querySelector<HTMLElement>("h1")
        ?.focus({ preventScroll: true });
    }
  }, [open, location.pathname, id]);

  useEffect(() => {
    if (!open) return;
    const oldTitle = document.title;
    document.title = `${item ? (vi ? item.name : item.nameEn) : vi ? "Khám phá di sản Việt Nam" : "Explore Vietnamese heritage"} — Đường Sách`;
    return () => {
      document.title = oldTitle;
    };
  }, [open, item, vi]);

  const close = () => {
    navigate("/");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(".heritage-bookmark")
        ?.focus({ preventScroll: true }),
    );
  };

  if (!heritageList.length) {
    return (
      <div
        id="heritage-page-panel"
        ref={panel}
        className={`heritage-sheet ${open ? "is-open" : ""}`}
        inert={!open}
        aria-hidden={!open || undefined}
      >
        <main className="heritage-document">
          <section className="heritage-not-found" aria-busy="true">
            <h1 tabIndex={-1}>{vi ? "Đang tải dữ liệu di sản…" : "Loading heritage content…"}</h1>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      id="heritage-page-panel"
      ref={panel}
      className={`heritage-sheet ${open ? "is-open" : ""}`}
      inert={!open}
      aria-hidden={!open || undefined}
      onScroll={() => {
        if (open && !id && panel.current)
          catalogScroll.current = panel.current.scrollTop;
      }}
    >
      <main className="heritage-document">
        {!heritageList.length ? (
          <section className="heritage-not-found" aria-busy="true">
            <h1 tabIndex={-1}>{vi ? "Đang tải dữ liệu di sản…" : "Loading heritage content…"}</h1>
          </section>
        ) : id && !item ? (
          <section className="heritage-not-found">
            <h1 tabIndex={-1}>
              {vi ? "Không tìm thấy di sản" : "Heritage not found"}
            </h1>
            <Link to="/di-san">
              <ArrowLeft size={18} />
              {vi ? "Về danh mục di sản" : "Back to collection"}
            </Link>
          </section>
        ) : item ? (
          <>
            <section className="heritage-detail-hero" key={item.id}>
              <img
                src={imageFor(item) || undefined}
                alt={imageAlt(item)}
                className="heritage-detail-cover"
                fetchPriority="high"
              />
              <div className="heritage-detail-shade" />
              <div className="heritage-inner">
                <Link to="/di-san" className="heritage-back">
                  <ArrowLeft size={17} />
                  {vi ? "Tất cả di sản" : "All heritage sites"}
                </Link>
                <div className="heritage-detail-heading">
                  <span className="heritage-kicker">
                    {item.code} <span /> {vi ? item.category : item.categoryEn}
                  </span>
                  <h1 tabIndex={-1}>{vi ? item.name : item.nameEn}</h1>
                  <p>
                    <MapPin size={17} />
                    {vi ? item.province : item.provinceEn}
                  </p>
                </div>
              </div>
            </section>
            <div
              className="heritage-inner heritage-reading-layout"
              key={`${item.id}-body`}
            >
              <article className="heritage-reading">
                <p className="heritage-photo-credit">
                  <a
                    href={imageInfo(item).source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {vi ? "Ảnh" : "Photo"}: {imageInfo(item).author}
                  </a>{" "}
                  ·{" "}
                  <a
                    href={('licenseUrl' in imageInfo(item) ? (imageInfo(item) as any).licenseUrl : imageInfo(item).source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {imageInfo(item).license}
                  </a>{" "}
                  · Wikimedia Commons
                </p>
                <p className="heritage-lead">
                  {vi ? item.briefDesc : item.briefDescEn}
                </p>
                <section>
                  <span className="heritage-section-marker">
                    {vi ? "Dấu ấn thời gian" : "Through time"}
                  </span>
                  <h2>
                    {vi ? "Câu chuyện di sản" : "The story of this place"}
                  </h2>
                  <p>{vi ? item.story : item.storyEn}</p>
                </section>
                <section>
                  <span className="heritage-section-marker">
                    {vi
                      ? "Những điều làm nên bản sắc"
                      : "A distinctive identity"}
                  </span>
                  <h2>{vi ? "Giá trị còn mãi" : "An enduring legacy"}</h2>
                  <ul className="heritage-values">
                    {(vi ? item.highlights : item.highlightsEn).map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2>{vi ? "Thông tin di sản" : "Heritage at a glance"}</h2>
                  <dl className="heritage-facts">
                    <div>
                      <dt>
                        {vi
                          ? "Địa chỉ theo tư liệu"
                          : "Location in the archive"}
                      </dt>
                      <dd>{vi ? item.address : item.addressEn}</dd>
                    </div>
                    <div>
                      <dt>{vi ? "Niên đại" : "Period"}</dt>
                      <dd>{vi ? item.period : item.periodEn}</dd>
                    </div>
                    <div>
                      <dt>{vi ? "Loại hình" : "Category"}</dt>
                      <dd>{vi ? item.category : item.categoryEn}</dd>
                    </div>
                    <div>
                      <dt>{vi ? "Tư liệu tham khảo" : "Archive reference"}</dt>
                      <dd>{item.referenceSource}</dd>
                    </div>
                  </dl>
                  <p className="heritage-editor-note">
                    {vi
                      ? "Thông tin được quản lý và cập nhật trong hệ thống Đường Sách."
                      : "This information is managed and updated in the Book Street system."}
                  </p>
                </section>
                <Link to="/di-san" className="heritage-return">
                  <ArrowLeft size={18} />
                  {vi
                    ? "Quay về danh mục di sản"
                    : "Back to the heritage collection"}
                </Link>
              </article>
              <aside className="heritage-qr-aside">
                <HeritageQr item={item} vi={vi} />
                <div className="heritage-aside-note">
                  <span>{item.code}</span>
                  <p>
                    {vi
                      ? "Một điểm đến. Một câu chuyện. Một dấu ấn để lưu giữ."
                      : "A place. A story. A memory to keep."}
                  </p>
                </div>
              </aside>
            </div>
            <section className="heritage-next heritage-inner">
              <span>{vi ? "Tiếp tục hành trình" : "Continue the journey"}</span>
              <Link
                to={`/di-san/${heritageList[(heritageList.indexOf(item) + 1) % heritageList.length].id}`}
              >
                <span>
                  {vi
                    ? heritageList[
                        (heritageList.indexOf(item) + 1) % heritageList.length
                      ].name
                    : heritageList[
                        (heritageList.indexOf(item) + 1) % heritageList.length
                      ].nameEn}
                </span>
                <ArrowRight size={26} />
              </Link>
            </section>
          </>
        ) : (
          <>
            <section className="heritage-collection-hero">
              <div className="heritage-inner heritage-hero-grid">
                <div className="heritage-introduction">
                  <button
                    type="button"
                    className="exp-btn-return-frameless"
                    onClick={close}
                    aria-label={vi ? "Trở về trang chủ Đường Sách" : "Return to Book Street home"}
                  >
                    <ArrowLeft size={16} />
                    <span>{vi ? "Trở về trang chủ" : "Back to Home"}</span>
                  </button>

                  <span className="heritage-kicker">
                    <span />
                    {vi
                      ? "Tủ sách di sản Việt Nam"
                      : "The Vietnamese heritage collection"}
                  </span>
                  <h1 tabIndex={-1}>
                    {vi ? (
                      <>
                        Mở một trang sách.
                        <br />
                        Chạm một miền di sản.
                      </>
                    ) : (
                      <>
                        Open a page.
                        <br />
                        Discover a heritage.
                      </>
                    )}
                  </h1>
                  <p>
                    {vi
                      ? "Khám phá các điểm đến và câu chuyện văn hóa đang được lưu giữ trong hệ thống Đường Sách."
                      : "Explore the places and cultural stories maintained in the Book Street system."}
                  </p>
                  
                  <div className="heritage-hero-footnote">
                    <strong>{heritageList.length}</strong>
                    <span>{vi ? "di sản tiêu biểu" : "heritage stories"}</span>
                    <i />
                    <QrCode size={17} />
                    <span>
                      {vi ? "Mỗi di sản một mã QR" : "A QR for every story"}
                    </span>
                  </div>
                </div>
                <Link
                  className="heritage-featured"
                  to={`/di-san/${heritageList[0]?.id}`}
                  aria-label={
                    vi
                      ? `Khám phá ${heritageList[0]?.name || ''}`
                      : `Explore ${heritageList[0]?.nameEn || heritageList[0]?.name || ''}`
                  }
                >
                  <img
                    src={imageFor(heritageList[0]) || undefined}
                    alt={imageAlt(heritageList[0])}
                    fetchPriority="high"
                  />
                  <span className="heritage-image-ribbon">01</span>
                  <div>
                    <span>{vi ? "Dừng chân tại" : "Our first stop"}</span>
                    <h2>{vi ? heritageList[0]?.name : (heritageList[0]?.nameEn || heritageList[0]?.name)}</h2>
                    <span>
                      {vi
                        ? "Một thời vàng son bên dòng Hương Giang"
                        : "An imperial story beside the Perfume River"}
                    </span>
                  </div>
                  <ArrowRight className="heritage-featured-arrow" size={24} />
                </Link>
              </div>
            </section>
            <section
              className="heritage-inner heritage-collection"
              id="heritage-collection"
            >
              <div className="heritage-collection-title">
                <div>
                  <span className="heritage-section-marker">
                    {vi ? "Đi dọc những trang sử" : "Explore the archive"}
                  </span>
                  <h2>
                    {vi ? "Chọn miền di sản của bạn" : "Find your next story"}
                  </h2>
                </div>
                <label className="heritage-search">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      vi
                        ? "Tìm di sản, địa phương…"
                        : "Search sites and places…"
                    }
                    aria-label={vi ? "Tìm kiếm di sản" : "Search heritage"}
                  />
                </label>
              </div>
              <div className="heritage-filter-row">
                <div
                  className="heritage-filters"
                  aria-label={vi ? "Loại hình di sản" : "Heritage categories"}
                >
                  {[
                    ["all", "Tất cả", "All"],
                    ["culture", "Văn hóa", "Culture"],
                    ["nature", "Thiên nhiên", "Nature"],
                    ["history", "Lịch sử", "History"],
                  ].map(([value, label, en]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {vi ? label : en}
                    </button>
                  ))}
                </div>
                <span aria-live="polite">
                  {items.length} / {heritageList.length} {vi ? "di sản" : "sites"}
                </span>
              </div>
              <div className="heritage-collection-grid">
                {items.map((h) => (
                  <Link
                    to={`/di-san/${h.id}`}
                    key={h.id}
                    className="heritage-collection-card"
                  >
                    <div className="heritage-card-image">
                      <img src={imageFor(h) || undefined} alt={imageAlt(h)} loading="lazy" />
                      <span className="heritage-card-badge">{h.code.replace("DS-", "")}</span>
                    </div>
                    <div className="heritage-card-copy">
                      <span className="heritage-card-place">
                        <MapPin size={13} />
                        {vi ? h.province : h.provinceEn}
                      </span>
                      <h3>{vi ? h.name : h.nameEn}</h3>
                      <p>{vi ? h.briefDesc : h.briefDescEn}</p>
                      <div className="heritage-card-bottom">
                        <span>{vi ? "Đọc câu chuyện" : "Read the story"}</span>
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {!items.length && (
                <div className="heritage-empty">
                  <h3>
                    {vi
                      ? "Chưa tìm thấy di sản phù hợp"
                      : "No matching heritage sites"}
                  </h3>
                  <button
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                  >
                    {vi ? "Xem lại toàn bộ di sản" : "Show all sites"}
                  </button>
                </div>
              )}
              <p className="heritage-collection-note">
                {vi
                  ? `Bộ sưu tập gồm ${heritageList.length} hồ sơ di sản đang được công bố.`
                  : `The collection contains ${heritageList.length} published heritage profiles.`}
              </p>
            </section>
          </>
        )}
        <footer className="heritage-sheet-footer">
          <span>
            ĐƯỜNG SÁCH <span> / </span>
            {vi ? "Không gian di sản" : "Heritage collection"}
          </span>
        </footer>
      </main>
    </div>
  );
}

function HeritageQr({ item, vi }: { item: HeritageProfile; vi: boolean }) {
  const url = `${window.location.origin}/di-san/${item.id}`;
  return (
    <div className="heritage-qr-card">
      <span className="heritage-section-marker">
        {vi ? "Mang câu chuyện theo bạn" : "Take the story with you"}
      </span>
      <h2>{vi ? "Quét để khám phá" : "Scan to explore"}</h2>
      <div className="heritage-qr-code">
        <QRCodeSVG
          value={url}
          size={184}
          level="M"
          marginSize={4}
          title={`${item.code}: ${vi ? item.name : item.nameEn}`}
        />
      </div>
      <strong>{item.code}</strong>
      <p>
        {vi
          ? "Mã QR mở trực tiếp trang di sản này."
          : "This QR opens this heritage profile directly."}
      </p>
      <a href={url}>
        {vi ? "Mở liên kết di sản" : "Open heritage link"}
        <ArrowRight size={14} />
      </a>
      {/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && (
        <small>
          {vi
            ? "Bản local: liên kết hoạt động trên máy đang chạy website. Khi triển khai, QR tự dùng địa chỉ website mới."
            : "Local preview: this link works on the host computer. After deployment the QR uses the website address."}
        </small>
      )}
    </div>
  );
}
