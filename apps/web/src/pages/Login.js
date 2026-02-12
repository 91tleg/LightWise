import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/lightwise.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    navigate("/overview");
  };

  return (
    <div className="lwLogin">
      <div className="lwLoginCard">
        <div className="lwLoginBrand">
          <img src="/images/lightwise-logo.jpeg" alt="LightWise" className="lwLoginLogo" />
          <img src="/images/lightwise-motto.jpeg" alt="LightWise Motto" className="lwLoginMotto" />
        </div>

        <form className="lwLoginForm" onSubmit={onSubmit}>
          <input
            className="lwInput"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="lwInput"
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <button className="lwPrimaryBtn" type="submit">Log in</button>

          <button className="lwSecondaryBtn" type="button" onClick={() => alert("Sign up later")}>
            Sign up
          </button>

          <button className="lwLinkBtn" type="button" onClick={() => alert("Reset later")}>
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}
