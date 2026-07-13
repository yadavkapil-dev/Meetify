import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const withAuth = (Component) => {
  const AuthComponent = (props) => {
    const router = useNavigate();

    useEffect(() => {
      if (!localStorage.getItem("token")) {
        router("/auth");
      }
    }, [router]);

    return <Component {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
