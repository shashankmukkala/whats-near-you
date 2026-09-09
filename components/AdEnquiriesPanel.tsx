"use client";

export type AdEnquiry = {
  id: string;
  brand_name: string;
  ad_format: "map_rail" | "aircraft";
  contact_name: string;
  contact: string;
  image_url: string | null;
  target_url: string | null;
  campaign_start: string | null;
  campaign_end: string | null;
  message: string | null;
  payment_proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type Props = { enquiries: AdEnquiry[]; onStatus: (id: string, status: "approved" | "rejected") => void; onClose: () => void };

const FORMAT_LABELS = { map_rail: "Five-slot rail", billboard: "3D billboard", aircraft: "Aircraft banner" };
const FORMAT_PRICES = { map_rail: "₹1,000", billboard: "₹3,000", aircraft: "₹3,000" };

export default function AdEnquiriesPanel({ enquiries, onStatus, onClose }: Props) {
  return (
    <section className="admin-enquiries-panel panel-elevated">
      <header className="admin-enquiries-header"><div><span className="ad-rail-kicker">ADVERTISING</span><h2>Campaign enquiries</h2><p>{enquiries.filter((item) => item.status === "pending").length} awaiting review</p></div><button type="button" onClick={onClose} aria-label="Close enquiries">×</button></header>
      <div className="admin-enquiries-list">
        {enquiries.length === 0 && <div className="admin-enquiries-empty">No advertiser enquiries yet.</div>}
        {enquiries.map((enquiry) => (
          <article key={enquiry.id} className="admin-enquiry-item">
            <div className="admin-enquiry-item-top"><div><span className="admin-enquiry-format">{FORMAT_LABELS[enquiry.ad_format]} · {FORMAT_PRICES[enquiry.ad_format]}</span><h3>{enquiry.brand_name}</h3></div><span className={`admin-enquiry-status status-${enquiry.status}`}>{enquiry.status}</span></div>
            <div className="admin-enquiry-meta">{enquiry.contact_name} · {enquiry.contact}</div>
            {(enquiry.campaign_start || enquiry.campaign_end) && <div className="admin-enquiry-meta">Campaign: {enquiry.campaign_start || "Any date"} → {enquiry.campaign_end || "Open ended"}</div>}
            {enquiry.message && <p className="admin-enquiry-message">{enquiry.message}</p>}
            <div className="admin-enquiry-links">{enquiry.image_url && <a href={enquiry.image_url} target="_blank" rel="noreferrer">View creative ↗</a>}{enquiry.target_url && <a href={enquiry.target_url} target="_blank" rel="noreferrer">Destination ↗</a>}{enquiry.payment_proof_url && <a href={enquiry.payment_proof_url} target="_blank" rel="noreferrer">Payment proof ↗</a>}</div>
            {enquiry.status === "pending" && <div className="admin-enquiry-actions"><button type="button" onClick={() => onStatus(enquiry.id, "rejected")} className="admin-enquiry-reject">Reject</button><button type="button" onClick={() => onStatus(enquiry.id, "approved")} className="admin-enquiry-approve">Approve enquiry</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
