export function Icon({ kind = "document" }: { kind?: "document" | "folder" | "about" }) {
  return (
    <svg className={`file-icon icon-${kind}`} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {kind === "folder" ? (
        <>
          <path d="M3 8h11l3 4h12v16H3z" fill="#d8bd6a" stroke="currentColor" />
          <path d="M3 15h26l-3 13H3z" fill="#ead697" stroke="currentColor" />
          <path d="M5 17h21" stroke="#fff7d4" />
        </>
      ) : kind === "about" ? (
        <>
          <rect x="4" y="4" width="24" height="24" fill="#d4d1c8" stroke="currentColor" />
          <path d="M5 5h22v5H5z" fill="#253d65" />
          <path d="M16 15v8m-2 0h5M16 12v1" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M7 3h13l6 6v20H7z" fill="#fbf7ef" stroke="currentColor" />
          <path d="M20 3v7h6M11 15h11m-11 4h11m-11 4h8" stroke="currentColor" />
          <path d="M9 4v23" stroke="white" />
        </>
      )}
    </svg>
  )
}
