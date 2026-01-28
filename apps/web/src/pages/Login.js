import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {

  // ===== HOOKS / STATE BLOCK =====
  // useNavigate is used to change pages after login.
  // email and pw store what the user types in the input fields.
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  // ===== SUBMIT HANDLER BLOCK =====
  // This function runs when the login form is submitted.
  // It prevents the page from refreshing and sends the user to the Overview page.
  const onSubmit = (e) => {
    e.preventDefault();
    navigate("/overview");
  };

 
  return (

    // This is the outer container for the whole login page
    <div className="lwLogin">

      {/* 
        This block is the centered login card.
        It holds the logo, the motto, and the login form.
      */}
      <div className="lwLoginCard">

        {/* 
          This block displays the LightWise brand images at the top of the login card.
          It shows the logo and the motto.
        */}
        <div className="lwLoginBrand">
          <img
            src="/images/lightwise-logo.jpeg"
            alt="LightWise"
            className="lwLoginLogo"
          />
          <img
            src="/images/lightwise-motto.jpeg"
            alt="LightWise Motto"
            className="lwLoginMotto"
          />
        </div>

        {/* 
          This block is the login form.
          It contains the email input, password input, and action buttons.
        */}
        <form className="lwLoginForm" onSubmit={onSubmit}>

          {/* 
            This input lets the user type their email.
            Its value is stored in the email state.
          */}
          <input
            className="lwInput"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* 
            This input lets the user type their password.
            Its value is stored in the pw state and hidden on the screen.
          */}
          <input
            className="lwInput"
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          {/* 
            This button submits the form and triggers the login process.
            For now, it simply navigates to the Overview page.
          */}
          <button className="lwPrimaryBtn" type="submit">
            Log in
          </button>

          {/* 
            This button represents the Sign Up action.
            For now, it only shows a placeholder alert.
          */}
          <button
            className="lwSecondaryBtn"
            type="button"
            onClick={() => alert("Sign up later")}
          >
            Sign up
          </button>

          {/* 
            This button represents the Forgot Password action.
            For now, it only shows a placeholder alert.
          */}
          <button
            className="lwLinkBtn"
            type="button"
            onClick={() => alert("Reset later")}
          >
            Forgot password?
          </button>

        </form>
      </div>
    </div>
  );
}
