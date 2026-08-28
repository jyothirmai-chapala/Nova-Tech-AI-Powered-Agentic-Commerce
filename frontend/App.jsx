import { useEffect, useMemo, useState } from "react";
import { products } from "./data/products";
import "./App.css";

function App() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [cart, setCart] = useState([]);

  // ==================================================
  // NOVA AI STATE
  // ==================================================

  const [aiInput, setAiInput] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiUpsell, setAiUpsell] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // ==================================================
  // PAYMENT STATE
  // ==================================================

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [orderId, setOrderId] = useState("");

  // ==================================================
  // ANALYTICS STATE
  // ==================================================

  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ==================================================
  // CATEGORIES
  // ==================================================

  const categories = [
    "All",
    "Workspace",
    "Audio",
    "Power",
  ];

  // ==================================================
  // LOAD RAZORPAY
  // ==================================================

  useEffect(() => {
    const script = document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // ==================================================
  // LOAD ANALYTICS
  // ==================================================

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);

    try {
      const [metricsResponse, auditResponse] =
        await Promise.all([
          fetch(
            "http://127.0.0.1:8000/admin/metrics"
          ),

          fetch(
            "http://127.0.0.1:8000/admin/audit"
          ),
        ]);

      if (!metricsResponse.ok) {
        throw new Error(
          "Failed to load revenue metrics"
        );
      }

      if (!auditResponse.ok) {
        throw new Error(
          "Failed to load audit trail"
        );
      }

      const metricsData =
        await metricsResponse.json();

      const auditData =
        await auditResponse.json();

      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }

      if (auditData.success) {
        setAuditLogs(auditData.audit);
      }
    } catch (error) {
      console.error(
        "Analytics loading failed:",
        error
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ==================================================
  // LOAD ANALYTICS ON PAGE LOAD
  // ==================================================

  useEffect(() => {
    loadAnalytics();
  }, []);

  // ==================================================
  // PRODUCT SEARCH
  // ==================================================

  const filteredProducts = useMemo(() => {
    const searchText =
      search.toLowerCase().trim();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      if (!searchText) {
        return matchesCategory;
      }

      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(searchText) ||

        product.description
          .toLowerCase()
          .includes(searchText) ||

        product.category
          .toLowerCase()
          .includes(searchText) ||

        product.tags.some((tag) =>
          tag
            .toLowerCase()
            .includes(searchText)
        );

      return (
        matchesCategory &&
        matchesSearch
      );
    });
  }, [search, selectedCategory]);

  // ==================================================
  // CART
  // ==================================================

  const addToCart = (product) => {
    setCart((currentCart) => {
      const existing =
        currentCart.find(
          (item) =>
            item.id === product.id
        );

      if (existing) {
        return currentCart.map(
          (item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity:
                item.quantity + 1,
            }
          : item
      )
    );
  };

  const decreaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) =>
            item.quantity > 0
        )
    );
  };

  const removeFromCart = (productId) => {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          item.id !== productId
      )
    );
  };

  const cartCount = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      item.price * item.quantity,
    0
  );

  // ==================================================
  // QUICK SEARCH
  // ==================================================

  const handleExampleSearch = (value) => {
    setSearch(value);

    setTimeout(() => {
      document
        .getElementById("shop")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 50);
  };

  // ==================================================
  // NOVA AI
  // ==================================================

  const handleAIRequest = async () => {
    const message = aiInput.trim();

    if (!message || aiLoading) {
      return;
    }

    setAiLoading(true);
    setAiMessage("");
    setAiRecommendations([]);
    setAiUpsell([]);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/ai/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend returned ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        "Nova API response:",
        data
      );

      // ==================================================
      // MAP RECOMMENDATIONS WITH LOCAL PRODUCT DATA
      // ==================================================

      const recommendations =
        (
          data.recommendations ||
          []
        ).map((backendProduct) => {
          const localProduct =
            products.find(
              (product) =>
                product.id ===
                backendProduct.id
            );

          return {
            ...localProduct,
            ...backendProduct,

            emoji:
              backendProduct.emoji ||
              localProduct?.emoji ||
              "🛍️",
          };
        });

      // ==================================================
      // MAP UPSELL PRODUCTS
      // ==================================================

      const upsell =
        (
          data.upsell ||
          []
        ).map((backendProduct) => {
          const localProduct =
            products.find(
              (product) =>
                product.id ===
                backendProduct.id
            );

          return {
            ...localProduct,
            ...backendProduct,

            emoji:
              backendProduct.emoji ||
              localProduct?.emoji ||
              "🛍️",
          };
        });

      setAiMessage(
        data.reply ||
          "I found some recommendations for you."
      );

      setAiRecommendations(
        recommendations
      );

      setAiUpsell(upsell);

      setAiInput("");

      // Refresh analytics
      loadAnalytics();
    } catch (error) {
      console.error(
        "Nova AI request failed:",
        error
      );

      setAiMessage(
        "Sorry, Nova is currently unable to connect to the AI service. Please make sure the FastAPI backend is running."
      );

      setAiRecommendations([]);
      setAiUpsell([]);
    } finally {
      setAiLoading(false);
    }
  };

  // ==================================================
  // ADD ALL RECOMMENDATIONS
  // ==================================================

  const addAllRecommendations = () => {
    aiRecommendations.forEach(
      (product) => {
        addToCart(product);
      }
    );
  };

  // ==================================================
  // RAZORPAY CHECKOUT
  // ==================================================

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert(
        "Your cart is empty."
      );
      return;
    }

    if (!window.Razorpay) {
      alert(
        "Razorpay Checkout is still loading. Please try again."
      );
      return;
    }

    setPaymentLoading(true);
    setPaymentSuccess(false);
    setPaymentId("");
    setOrderId("");

    try {
      // ==================================================
      // STEP 1: CREATE RAZORPAY ORDER
      // ==================================================

      const response =
        await fetch(
          "http://127.0.0.1:8000/payment/create-order",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              amount: cartTotal,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          `Payment backend returned ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        "Razorpay order response:",
        data
      );

      if (!data.success) {
        throw new Error(
          data.error ||
            "Unable to create Razorpay order."
        );
      }

      if (!data.order_id) {
        throw new Error(
          "Order ID was not returned by backend."
        );
      }

      if (!data.key_id) {
        throw new Error(
          "Razorpay Key ID was not returned by backend."
        );
      }

      // ==================================================
      // STEP 2: RAZORPAY OPTIONS
      // ==================================================

      const options = {
        key: data.key_id,

        amount: data.amount,

        currency:
          data.currency || "INR",

        name: "NOVA TECH",

        description:
          "Nova Tech Shopping Order",

        order_id: data.order_id,

        // ==================================================
        // STEP 3: PAYMENT SUCCESS
        // ==================================================

        handler: async function (
          paymentResponse
        ) {
          console.log(
            "Razorpay payment response:",
            paymentResponse
          );

          try {
            // ==================================================
            // STEP 4: VERIFY PAYMENT
            // ==================================================

            const verifyResponse =
              await fetch(
                "http://127.0.0.1:8000/payment/verify",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body: JSON.stringify({
                    razorpay_order_id:
                      paymentResponse.razorpay_order_id,

                    razorpay_payment_id:
                      paymentResponse.razorpay_payment_id,

                    razorpay_signature:
                      paymentResponse.razorpay_signature,
                  }),
                }
              );

            if (!verifyResponse.ok) {
              throw new Error(
                `Verification backend returned ${verifyResponse.status}`
              );
            }

            const verificationResult =
              await verifyResponse.json();

            console.log(
              "Payment verification result:",
              verificationResult
            );

            // ==================================================
            // STEP 5: VERIFIED PAYMENT
            // ==================================================

            if (
              verificationResult.success &&
              verificationResult.verified
            ) {
              setPaymentId(
                paymentResponse.razorpay_payment_id
              );

              setOrderId(
                paymentResponse.razorpay_order_id
              );

              setPaymentSuccess(true);

              // Clear cart ONLY after successful verification
              setCart([]);

              alert(
                "Payment successful and verified! 🎉"
              );

              // Refresh analytics
              await loadAnalytics();

              setTimeout(() => {
                document
                  .getElementById(
                    "order-confirmed"
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                  });
              }, 100);
            } else {
              alert(
                "Payment was completed, but verification failed. Please contact support."
              );

              await loadAnalytics();
            }
          } catch (error) {
            console.error(
              "Payment verification failed:",
              error
            );

            alert(
              "Payment was completed, but we could not verify it with the server. Please contact support."
            );

            await loadAnalytics();
          }
        },

        // ==================================================
        // CUSTOMER INFORMATION
        // ==================================================

        prefill: {
          name: "",
          email: "",
          contact: "",
        },

        // ==================================================
        // NOTES
        // ==================================================

        notes: {
          source: "Nova Tech",
        },

        // ==================================================
        // THEME
        // ==================================================

        theme: {
          color: "#111111",
        },

        // ==================================================
        // MODAL
        // ==================================================

        modal: {
          ondismiss: function () {
            console.log(
              "Razorpay checkout closed."
            );

            setPaymentLoading(false);

            loadAnalytics();
          },
        },
      };

      // ==================================================
      // STEP 6: CREATE RAZORPAY INSTANCE
      // ==================================================

      const razorpay =
        new window.Razorpay(options);

      // ==================================================
      // PAYMENT FAILED
      // ==================================================

      razorpay.on(
        "payment.failed",
        async function (response) {
          console.error(
            "Payment failed:",
            response?.error
          );

          const error =
            response?.error || {};

          // ==================================================
          // EXTRACT FAILURE INFORMATION
          // ==================================================

          const failedOrderId =
            data.order_id ||
            error.metadata?.order_id ||
            null;

          const failedPaymentId =
            error.metadata?.payment_id ||
            error.payment_id ||
            null;

          // ==================================================
          // RECORD FAILED PAYMENT
          // ==================================================

          try {
            const failedPaymentResponse =
              await fetch(
                "http://127.0.0.1:8000/payment/failed",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body: JSON.stringify({
                    razorpay_order_id:
                      failedOrderId,

                    razorpay_payment_id:
                      failedPaymentId,

                    amount:
                      cartTotal,

                    error_code:
                      error.code ||
                      null,

                    error_description:
                      error.description ||
                      "Razorpay payment failed",

                    error_source:
                      error.source ||
                      null,

                    error_step:
                      error.step ||
                      null,

                    error_reason:
                      error.reason ||
                      null,
                  }),
                }
              );

            if (!failedPaymentResponse.ok) {
              throw new Error(
                `Failed payment endpoint returned ${failedPaymentResponse.status}`
              );
            }

            const failedPaymentData =
              await failedPaymentResponse.json();

            console.log(
              "Failed payment audit response:",
              failedPaymentData
            );
          } catch (auditError) {
            console.error(
              "Unable to record failed payment:",
              auditError
            );
          }

          // ==================================================
          // USER MESSAGE
          // ==================================================

          alert(
            "Payment failed. Please try again."
          );

          // ==================================================
          // REFRESH ANALYTICS
          // ==================================================

          await loadAnalytics();

          setPaymentLoading(false);
        }
      );

      // ==================================================
      // OPEN RAZORPAY
      // ==================================================

      razorpay.open();

    } catch (error) {
      console.error(
        "Checkout failed:",
        error
      );

      alert(
        error.message ||
          "Unable to start checkout. Please try again."
      );

      setPaymentLoading(false);
    }
  };

  // ==================================================
  // FORMAT DATE
  // ==================================================

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "-";
    }

    try {
      return new Date(
        timestamp
      ).toLocaleString("en-IN");
    } catch {
      return timestamp;
    }
  };

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="app">

      {/* ==================================================
          NAVBAR
      ================================================== */}

      <nav className="navbar">

        <div className="brand">

          <div className="brand-mark">
            N
          </div>

          <div>
            <div className="brand-name">
              NOVA TECH
            </div>

            <div className="brand-subtitle">
              Intelligent Commerce
            </div>
          </div>

        </div>

        <div className="nav-links">

          <a href="#shop">
            Shop
          </a>

          <a href="#collections">
            Collections
          </a>

          <a href="#analytics">
            Analytics
          </a>

          <a href="#about">
            About
          </a>

        </div>

        <button
          className="cart-button"
          onClick={() =>
            document
              .getElementById("cart")
              ?.scrollIntoView({
                behavior: "smooth",
              })
          }
        >
          <span>
            Cart
          </span>

          <span className="cart-count">
            {cartCount}
          </span>
        </button>

      </nav>

      <main>

        {/* ==================================================
            HERO
        ================================================== */}

        <section className="hero">

          <div className="hero-badge">

            <span className="pulse"></span>

            AI-powered commerce

          </div>

          <h1>
            Technology that
            <br />
            <span>
              fits your life.
            </span>
          </h1>

          <p className="hero-description">
            Discover products that make sense
            for you.
            <br />
            No endless scrolling. No guesswork.
          </p>

          <div className="smart-search">

            <span className="search-icon">
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search products..."
            />

            <span className="search-hint">
              ⌘ K
            </span>

          </div>

          <div className="search-examples">

            <span>
              Try:
            </span>

            <button
              onClick={() =>
                handleExampleSearch(
                  "workspace"
                )
              }
            >
              "Something for my workspace"
            </button>

            <button
              onClick={() =>
                handleExampleSearch(
                  "wireless"
                )
              }
            >
              "Wireless essentials"
            </button>

            <button
              onClick={() =>
                handleExampleSearch(
                  "audio"
                )
              }
            >
              "Something for focus"
            </button>

          </div>

        </section>

        {/* ==================================================
            NOVA INTELLIGENCE
        ================================================== */}

        <section className="ai-preview">

          <div className="ai-icon">
            ✦
          </div>

          <div className="ai-preview-content">

            <span className="eyebrow">
              NOVA INTELLIGENCE
            </span>

            <h2>
              Tell Nova what you need.
            </h2>

            <p>
              Describe what you're looking for,
              your use case, or your budget.
            </p>

          </div>

          <div className="ai-example">

            <input
              type="text"
              value={aiInput}
              onChange={(event) =>
                setAiInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  handleAIRequest();
                }
              }}
              placeholder='Try "I need a mouse under ₹1,000"'
              disabled={aiLoading}
            />

            <button
              onClick={
                handleAIRequest
              }
              className="arrow"
              aria-label="Ask Nova"
              disabled={aiLoading}
            >
              {aiLoading
                ? "..."
                : "→"}
            </button>

          </div>

          {aiMessage && (
            <div className="ai-response">

              <div className="nova-response-header">

                <span>
                  ✦ NOVA
                </span>

                <span className="ai-status">
                  {aiLoading
                    ? "Thinking..."
                    : "Recommendation ready"}
                </span>

              </div>

              <p>
                {aiMessage}
              </p>

              {aiRecommendations.length >
                0 && (

                <div className="ai-recommendations">

                  {aiRecommendations.map(
                    (product) => (

                      <div
                        className="ai-product"
                        key={
                          product.id
                        }
                      >

                        <div className="ai-product-icon">
                          {
                            product.emoji
                          }
                        </div>

                        <div className="ai-product-info">

                          <strong>
                            {
                              product.name
                            }
                          </strong>

                          <span>
                            {
                              product.description
                            }
                          </span>

                          <b>
                            ₹
                            {Number(
                              product.price
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </b>

                        </div>

                        <button
                          className="ai-add-button"
                          onClick={() =>
                            addToCart(
                              product
                            )
                          }
                        >
                          Add +
                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

              {aiRecommendations.length >
                1 && (

                <button
                  className="setup-button"
                  onClick={
                    addAllRecommendations
                  }
                >
                  Add recommended products →
                </button>

              )}

              {aiUpsell.length >
                0 && (

                <div className="cross-sell">

                  <div className="cross-sell-title">
                    ✦ Complete your setup
                  </div>

                  <p>
                    You may also want:
                  </p>

                  <div className="cross-sell-list">

                    {aiUpsell
                      .slice(0, 2)
                      .map(
                        (product) => (

                          <button
                            key={
                              product.id
                            }
                            className="cross-sell-item"
                            onClick={() =>
                              addToCart(
                                product
                              )
                            }
                          >

                            <span>
                              {
                                product.emoji
                              }
                            </span>

                            <span>
                              {
                                product.name
                              }
                            </span>

                            <strong>
                              ₹
                              {Number(
                                product.price
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </strong>

                            <small>
                              Add +
                            </small>

                          </button>

                        )
                      )}

                  </div>

                </div>

              )}

            </div>
          )}

        </section>

        {/* ==================================================
            CATEGORIES
        ================================================== */}

        <section
          id="collections"
          className="section"
        >

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                EXPLORE
              </span>

              <h2>
                Shop by intent.
              </h2>

            </div>

            <p>
              Curated technology for the way
              you actually work and live.
            </p>

          </div>

          <div className="category-grid">

            {categories.map(
              (category) => (

                <button
                  key={
                    category
                  }
                  className={`category-card ${
                    selectedCategory ===
                    category
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedCategory(
                      category
                    )
                  }
                >

                  <span className="category-icon">

                    {category ===
                      "All" &&
                      "✦"}

                    {category ===
                      "Workspace" &&
                      "⌘"}

                    {category ===
                      "Audio" &&
                      "◉"}

                    {category ===
                      "Power" &&
                      "ϟ"}

                  </span>

                  <span>
                    {category}
                  </span>

                  <span className="category-arrow">
                    →
                  </span>

                </button>

              )
            )}

          </div>

        </section>

        {/* ==================================================
            PRODUCTS
        ================================================== */}

        <section
          id="shop"
          className="section products-section"
        >

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                THE COLLECTION
              </span>

              <h2>
                Built for better days.
              </h2>

            </div>

            <span className="product-count">
              {
                filteredProducts.length
              }{" "}
              products
            </span>

          </div>

          <div className="product-grid">

            {filteredProducts.map(
              (product) => (

                <article
                  className="product-card"
                  key={
                    product.id
                  }
                >

                  <div className="product-visual">

                    <span className="product-emoji">
                      {
                        product.emoji
                      }
                    </span>

                    <span className="product-category">
                      {
                        product.category
                      }
                    </span>

                  </div>

                  <div className="product-info">

                    <div>

                      <h3>
                        {
                          product.name
                        }
                      </h3>

                      <p>
                        {
                          product.description
                        }
                      </p>

                    </div>

                    <div className="product-bottom">

                      <span className="price">
                        ₹
                        {Number(
                          product.price
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </span>

                      <button
                        className="add-button"
                        onClick={() =>
                          addToCart(
                            product
                          )
                        }
                      >
                        Add +
                      </button>

                    </div>

                  </div>

                </article>

              )
            )}

          </div>

          {filteredProducts.length ===
            0 && (

            <div className="empty-state">

              <div>
                ⌕
              </div>

              <h3>
                No products found
              </h3>

              <p>
                Try a different search or
                category.
              </p>

            </div>

          )}

        </section>

        {/* ==================================================
            ORDER CONFIRMED
        ================================================== */}

        {paymentSuccess && (

          <section
            id="order-confirmed"
            className="cart-section"
          >

            <div className="cart-header">

              <div>

                <span className="eyebrow">
                  ORDER CONFIRMED
                </span>

                <h2>
                  Payment successful! 🎉
                </h2>

              </div>

              <span className="cart-count-large">
                ✓ Paid
              </span>

            </div>

            <div className="cart-items-full">

              <div className="cart-item">

                <div className="cart-item-icon">
                  ✓
                </div>

                <div className="cart-item-info">

                  <strong>
                    Your order has been confirmed
                  </strong>

                  <span>
                    Razorpay payment verified successfully.
                  </span>

                </div>

              </div>

              <div className="cart-item">

                <div className="cart-item-icon">
                  #
                </div>

                <div className="cart-item-info">

                  <strong>
                    Order ID
                  </strong>

                  <span>
                    {orderId}
                  </span>

                </div>

              </div>

              <div className="cart-item">

                <div className="cart-item-icon">
                  ₹
                </div>

                <div className="cart-item-info">

                  <strong>
                    Payment ID
                  </strong>

                  <span>
                    {paymentId}
                  </span>

                </div>

              </div>

            </div>

            <div className="cart-summary">

              <div>

                <span>
                  Status
                </span>

                <strong>
                  VERIFIED ✓
                </strong>

              </div>

            </div>

          </section>

        )}

        {/* ==================================================
            CART
        ================================================== */}

        {cart.length > 0 && (

          <section
            id="cart"
            className="cart-section"
          >

            <div className="cart-header">

              <div>

                <span className="eyebrow">
                  YOUR BASKET
                </span>

                <h2>
                  Ready to checkout?
                </h2>

              </div>

              <span className="cart-count-large">
                {cartCount} items
              </span>

            </div>

            <div className="cart-items-full">

              {cart.map(
                (item) => (

                  <div
                    className="cart-item"
                    key={
                      item.id
                    }
                  >

                    <div className="cart-item-icon">
                      {
                        item.emoji
                      }
                    </div>

                    <div className="cart-item-info">

                      <strong>
                        {
                          item.name
                        }
                      </strong>

                      <span>
                        ₹
                        {Number(
                          item.price
                        ).toLocaleString(
                          "en-IN"
                        )}{" "}
                        each
                      </span>

                    </div>

                    <div className="quantity-controls">

                      <button
                        onClick={() =>
                          decreaseQuantity(
                            item.id
                          )
                        }
                      >
                        −
                      </button>

                      <span>
                        {
                          item.quantity
                        }
                      </span>

                      <button
                        onClick={() =>
                          increaseQuantity(
                            item.id
                          )
                        }
                      >
                        +
                      </button>

                    </div>

                    <strong className="cart-item-total">
                      ₹
                      {(
                        Number(
                          item.price
                        ) *
                        item.quantity
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                    <button
                      className="remove-button"
                      onClick={() =>
                        removeFromCart(
                          item.id
                        )
                      }
                    >
                      Remove
                    </button>

                  </div>

                )
              )}

            </div>

            <div className="cart-summary">

              <div>

                <span>
                  Total
                </span>

                <strong>
                  ₹
                  {cartTotal.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

              <button
                className="checkout-button"
                onClick={
                  handleCheckout
                }
                disabled={
                  paymentLoading
                }
              >
                {paymentLoading
                  ? "Starting checkout..."
                  : "Proceed to checkout →"}
              </button>

            </div>

          </section>

        )}

        {/* ==================================================
            REVENUE + AUDIT DASHBOARD
        ================================================== */}

        <section
          id="analytics"
          className="section analytics-section"
        >

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                MERCHANT ANALYTICS
              </span>

              <h2>
                Revenue & Audit Trail
              </h2>

            </div>

            <button
              className="add-button"
              onClick={
                loadAnalytics
              }
              disabled={
                analyticsLoading
              }
            >
              {analyticsLoading
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>

          {/* ==================================================
              METRIC CARDS
          ================================================== */}

          <div className="category-grid">

            <div className="category-card">

              <span className="category-icon">
                ₹
              </span>

              <span>
                Total Revenue
              </span>

              <strong>
                ₹
                {Number(
                  metrics?.total_revenue ||
                    0
                ).toLocaleString(
                  "en-IN"
                )}
              </strong>

            </div>

            <div className="category-card">

              <span className="category-icon">
                ✓
              </span>

              <span>
                Successful Orders
              </span>

              <strong>
                {
                  metrics?.successful_orders ||
                  0
                }
              </strong>

            </div>

            <div className="category-card">

              <span className="category-icon">
                #
              </span>

              <span>
                Orders Created
              </span>

              <strong>
                {
                  metrics?.orders_created ||
                  0
                }
              </strong>

            </div>

            <div className="category-card">

              <span className="category-icon">
                ₹
              </span>

              <span>
                Average Order Value
              </span>

              <strong>
                ₹
                {Number(
                  metrics?.average_order_value ||
                    0
                ).toLocaleString(
                  "en-IN"
                )}
              </strong>

            </div>

            <div className="category-card">

              <span className="category-icon">
                !
              </span>

              <span>
                Failed Payments
              </span>

              <strong>
                {
                  metrics?.failed_payments ||
                  0
                }
              </strong>

            </div>

            <div className="category-card">

              <span className="category-icon">
                ✦
              </span>

              <span>
                Nova AI Queries
              </span>

              <strong>
                {
                  metrics?.ai_queries ||
                  0
                }
              </strong>

            </div>

          </div>

          {/* ==================================================
              CONVERSION
          ================================================== */}

          {metrics && (

            <div className="cart-section">

              <div className="cart-header">

                <div>

                  <span className="eyebrow">
                    PAYMENT PERFORMANCE
                  </span>

                  <h2>
                    Checkout Conversion
                  </h2>

                </div>

                <span className="cart-count-large">
                  {
                    metrics.payment_conversion_rate
                  }%
                </span>

              </div>

              <div className="cart-summary">

                <div>

                  <span>
                    Audit Events
                  </span>

                  <strong>
                    {
                      metrics.audit_events
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Verification Attempts
                  </span>

                  <strong>
                    {
                      metrics.verification_attempts
                    }
                  </strong>

                </div>

              </div>

            </div>

          )}

          {/* ==================================================
              AUDIT TRAIL
          ================================================== */}

          <div className="cart-section">

            <div className="cart-header">

              <div>

                <span className="eyebrow">
                  AUDIT TRAIL
                </span>

                <h2>
                  Recent Activity
                </h2>

              </div>

              <span className="cart-count-large">
                {
                  auditLogs.length
                } events
              </span>

            </div>

            {auditLogs.length ===
              0 ? (

              <div className="empty-state">

                <div>
                  ✓
                </div>

                <h3>
                  No audit events yet
                </h3>

                <p>
                  Activity will appear here when
                  users interact with Nova or make payments.
                </p>

              </div>

            ) : (

              <div className="cart-items-full">

                {auditLogs
                  .slice(0, 15)
                  .map(
                    (event) => (

                      <div
                        className="cart-item"
                        key={
                          event.id
                        }
                      >

                        <div className="cart-item-icon">
                          {event.status ===
                          "success"
                            ? "✓"
                            : "!"}
                        </div>

                        <div className="cart-item-info">

                          <strong>
                            {
                              event.event_type
                            }
                          </strong>

                          <span>
                            {
                              event.message
                            }
                          </span>

                          <small>
                            {
                              formatDate(
                                event.timestamp
                              )
                            }
                          </small>

                        </div>

                        <div className="cart-item-info">

                          {event.order_id && (

                            <span>
                              Order:{" "}
                              {
                                event.order_id
                              }
                            </span>

                          )}

                          {event.payment_id && (

                            <span>
                              Payment:{" "}
                              {
                                event.payment_id
                              }
                            </span>

                          )}

                        </div>

                        {event.amount !==
                          null &&
                          event.amount !==
                            undefined && (

                          <strong className="cart-item-total">

                            ₹
                            {Number(
                              event.amount
                            ).toLocaleString(
                              "en-IN"
                            )}

                          </strong>

                        )}

                      </div>

                    )
                  )}

              </div>

            )}

          </div>

        </section>

      </main>

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer id="about">

        <div>

          <strong>
            NOVA TECH
          </strong>

          <span>
            Commerce designed around people.
          </span>

        </div>

        <span>
          © 2026 Nova Tech
        </span>

      </footer>

    </div>
  );
}

export default App;