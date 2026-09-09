import { createBrowserRouter } from "react-router-dom";
import { CustomerLayout } from "./components/layout/CustomerLayout";
import { StoreHome } from "./pages/customer/Home";
import { PublicOnlyLayout } from "./components/auth/PublicOnlyLayout";
import { ProtectedLayout } from "./components/auth/ProtectedLayout";
import { RoleGuardLayout } from "./components/auth/RoleGuardLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { SignInPage } from "./pages/auth/Sign-in";
import { SignUpPage } from "./pages/auth/Sign-up";
import Collections from "./pages/customer/Collections";
import CollectionDetails from "./pages/customer/Collection-Details";
import CustomerOrderSuccessPage from "./pages/customer/Order-Sucess";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminCoupons from "./pages/admin/Promos";
import AdminOrders from "./pages/admin/Orders";
import AdminSettings from "./pages/admin/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <CustomerLayout />,
    children: [
      {
        index: true,
        element: <StoreHome />,
      },
      {
        path: "collections",
        element: <Collections />,
      },
      {
        path: "collection/:id",
        element: <CollectionDetails />,
      },
      {
        element: <PublicOnlyLayout />,
        children: [
          {
            path: "sign-in/*",
            element: <SignInPage />,
          },
          {
            path: "sign-up/*",
            element: <SignUpPage />,
          },
        ],
      },
      {
        element: <ProtectedLayout />,
        children: [
          {
            path: "order-success",
            element: <CustomerOrderSuccessPage />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <RoleGuardLayout allow={["admin"]} />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <AdminDashboard />,
              },
              {
                path: "products",
                element: <AdminProducts />,
              },
              {
                path: "coupons",
                element: <AdminCoupons />,
              },
              {
                path: "orders",
                element: <AdminOrders />,
              },
              {
                path: "settings",
                element: <AdminSettings />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
