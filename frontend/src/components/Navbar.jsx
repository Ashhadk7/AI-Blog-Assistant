import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        AI Blog.
      </Link>
      <div className="nav-links">
        <Link to="/">Home</Link>
      </div>
    </nav>
  );
}
