import { blogs } from "../data/blogs";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <h1>Exploring the <span>Future</span></h1>
        <p>Dive into our curated collection of articles exploring the cutting edge of artificial intelligence and technology trends.</p>
      </section>

      <div className="blog-grid">
        {blogs.map((blog) => (
          <Link to={`/blog/${blog.id}`} key={blog.id} className="blog-card">
            {blog.imageUrl && (
              <img src={blog.imageUrl} alt={blog.title} className="card-image" />
            )}
            <div className="card-content">
              <div className="card-meta">
                <span className="card-category">{blog.category}</span>
                <span>{blog.readTime}</span>
              </div>
              <h2 className="card-title">{blog.title}</h2>
              <p className="card-summary">{blog.summary}</p>
              <div className="card-footer">
                Read Article
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}