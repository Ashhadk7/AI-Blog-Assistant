import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

export default function BlogPage() {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3000/api/blogs")
      .then(res => res.json())
      .then(data => {
        const found = data.find((b) => String(b.id) === String(id));
        setBlog(found);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch blog:", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="loading">Loading article...</div>;

  if (!blog) {
    return (
      <div className="not-found">
        <h1>Article Not Found</h1>
        <p>The article you are looking for does not exist or has been moved.</p>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    );
  }

  return (
    <article className="article-container">
      <Link to="/" className="back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to articles
      </Link>

      <header className="article-header">
        <span className="article-category">{blog.category}</span>
        <h1 className="article-title">{blog.title}</h1>
        <div className="article-meta">
          <span>{blog.date}</span>
          <span>•</span>
          <span>{blog.readTime}</span>
        </div>
      </header>

      {blog.imageUrl && (
        <img src={blog.imageUrl} alt={blog.title} className="article-image" />
      )}

      <div className="article-content">
        {blog.content.split('\n\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}