import streamlit as st
import numpy as np
import pandas as pd
import folium
import plotly.express as px

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline

from sklearn.naive_bayes import GaussianNB
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, accuracy_score

from utils import normalize_district


def show_ml_page(df):
    st.title("Machine Learning: District Prediction (Spatio-Temporal)")

    # ---------------- Session State Init ----------------
    if "trained" not in st.session_state:
        st.session_state.trained = False
    if "results" not in st.session_state:
        st.session_state.results = {}
    if "selected_crime" not in st.session_state:
        st.session_state.selected_crime = None
    if "selected_model" not in st.session_state:
        st.session_state.selected_model = None

    # -------- Normalize District Names --------
    df = normalize_district(df)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")

    # -------- Feature Engineering --------
    df["weekday"] = df["Date"].dt.weekday
    df["is_weekend"] = df["weekday"].isin([5, 6]).astype(int)
    df["lat_bin"] = df["Latitude"].round(2)
    df["lon_bin"] = df["Longitude"].round(2)

    df = df.dropna(subset=["hour", "month", "weekday", "lat_bin", "lon_bin", "District_Name"])

    # -------- Crime Filter (State-safe) --------
    crime_types = sorted(df["Description"].unique())

    selected_crime = st.selectbox(
        "Select Crime Category",
        crime_types,
        index=crime_types.index(st.session_state.selected_crime)
        if st.session_state.selected_crime in crime_types else 0
    )

    # If crime changes, reset training state
    if selected_crime != st.session_state.selected_crime:
        st.session_state.selected_crime = selected_crime
        st.session_state.trained = False
        st.session_state.results = {}

    df = df[df["Description"] == selected_crime].copy()

    if df.empty:
        st.warning("No data available for this selection.")
        return

    # -------- Features & Target --------
    feature_cols = ["lat_bin", "lon_bin", "hour", "month", "weekday", "is_weekend"]
    X = df[feature_cols]
    y = df["District_Name"]

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # -------- Train / Test Split --------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.3, random_state=42, stratify=y_enc
    )

    # -------- Models --------
    models = {
        "Naive Bayes": Pipeline([("scaler", StandardScaler()), ("model", GaussianNB())]),
        "Logistic Regression": Pipeline([("scaler", StandardScaler()), ("model", LogisticRegression(max_iter=1000, class_weight="balanced"))]),
        "SVM": Pipeline([("scaler", StandardScaler()), ("model", SVC(kernel="rbf", probability=True, class_weight="balanced"))]),
        "Decision Tree": Pipeline([("scaler", StandardScaler()), ("model", DecisionTreeClassifier(max_depth=10, class_weight="balanced", random_state=42))]),
        "Random Forest": Pipeline([("scaler", StandardScaler()), ("model", RandomForestClassifier(n_estimators=200, max_depth=12, class_weight="balanced", random_state=42))]),
        "Gradient Boosting": Pipeline([("scaler", StandardScaler()), ("model", GradientBoostingClassifier(random_state=42))]),
        "MLP": Pipeline([("scaler", StandardScaler()), ("model", MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=300, random_state=42))]),
    }

    voting = VotingClassifier(
        estimators=[
            ("lr", models["Logistic Regression"]),
            ("svm", models["SVM"]),
            ("dt", models["Decision Tree"]),
        ],
        voting="soft"
    )
    models["Voting Ensemble (LR+SVM+DT)"] = voting

    # -------- Model Filter (State-safe) --------
    model_names = list(models.keys())

    selected_model = st.selectbox(
        "Choose Model",
        model_names,
        index=model_names.index(st.session_state.selected_model)
        if st.session_state.selected_model in model_names else 0
    )

    if selected_model != st.session_state.selected_model:
        st.session_state.selected_model = selected_model

    # -------- Train Button --------
    if st.button("Train Model"):
        st.info("Training... please wait ⏳")

        results = {}

        # Train selected model
        model = models[selected_model]
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        test_acc = accuracy_score(y_test, y_pred)

        results["selected"] = {
            "model_name": selected_model,
            "model": model,
            "test_acc": test_acc,
            "y_pred": y_pred,
            "report": classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True),
        }

        # Train all models for comparison
        comp_rows = []
        district_rows = []

        for name, m in models.items():
            m.fit(X_train, y_train)
            yp = m.predict(X_test)
            acc = accuracy_score(y_test, yp) * 100

            rep = classification_report(y_test, yp, target_names=le.classes_, output_dict=True)

            comp_rows.append({
                "Model": name,
                "Test Accuracy (%)": acc
            })

            for district in le.classes_:
                if district in rep:
                    district_rows.append({
                        "District": district,
                        "Model": name,
                        "f1-score": rep[district]["f1-score"] * 100,
                        "precision": rep[district]["precision"] * 100,
                        "recall": rep[district]["recall"] * 100,
                    })

        results["comparison_df"] = pd.DataFrame(comp_rows)
        results["district_df"] = pd.DataFrame(district_rows)

        # Save in session
        st.session_state.results = results
        st.session_state.trained = True

    # -------- Show Results (No retrain on filter change) --------
    if st.session_state.trained:
        res = st.session_state.results

        st.subheader("Test Performance (Selected Model)")
        st.write(f"✅ Test Accuracy: **{res['selected']['test_acc']*100:.2f}%**")

        # Model comparison charts
        st.subheader("Model Comparison")

        comp_df = res["comparison_df"]

        fig_bar = px.bar(
            comp_df,
            x="Model",
            y="Test Accuracy (%)",
            title="Model Comparison (Bar Chart)",
            text_auto=".2f"
        )
        fig_bar.update_layout(xaxis_tickangle=-45)
        st.plotly_chart(fig_bar, use_container_width=True)

        fig_line = px.line(
            comp_df,
            x="Model",
            y="Test Accuracy (%)",
            markers=True,
            title="Model Comparison (Line Chart)"
        )
        fig_line.update_layout(xaxis_tickangle=-45)
        st.plotly_chart(fig_line, use_container_width=True)

        # District-wise chart
        st.subheader("District-wise Model Performance")

        metric_choice_dw = st.selectbox(
            "Choose district-wise metric:",
            ["f1-score", "precision", "recall"],
            key="district_metric_choice"
        )

        district_df = res["district_df"]

        fig_district_models = px.bar(
            district_df,
            x="District",
            y=metric_choice_dw,
            color="Model",
            barmode="group",
            title=f"District-wise {metric_choice_dw.capitalize()} (%) Comparison Across Models",
            text_auto=".2f"
        )
        fig_district_models.update_layout(
            xaxis_tickangle=-45,
            yaxis_title="Score (%)"
        )
        st.plotly_chart(fig_district_models, use_container_width=True)

        # -------- Map with Hover + Legend --------
        st.subheader("Predicted District Map (Selected Model)")

        model = res["selected"]["model"]

        # Predict on FULL filtered dataset (not only test set)
        pred_all = model.predict(X)

        df_vis = df.copy()
        df_vis["Predicted_District"] = le.inverse_transform(pred_all)
        df_vis["Is_Correct"] = df_vis["Predicted_District"] == df_vis["District_Name"]

        center = [df_vis["Latitude"].mean(), df_vis["Longitude"].mean()]
        m = folium.Map(location=center, zoom_start=11)

        for _, row in df_vis.iterrows():
            color = "green" if row["Is_Correct"] else "red"

            tooltip_text = (
                f"Status: {'Correct' if row['Is_Correct'] else 'Wrong'}<br>"
                f"Actual: {row['District_Name']}<br>"
                f"Predicted: {row['Predicted_District']}"
            )

            folium.CircleMarker(
                location=[row["Latitude"], row["Longitude"]],
                radius=4,
                color=color,
                fill=True,
                fill_opacity=0.8,
                tooltip=tooltip_text,   # 👈 Hover effect
            ).add_to(m)

        # -------- Legend --------
        legend_html = """
        <div style="
            position: fixed;
            bottom: 50px;
            left: 50px;
            width: 180px;
            height: 90px;
            background-color: white;
            border:2px solid grey;
            z-index:9999;
            font-size:14px;
            padding: 10px;
        ">
        <b>Legend</b><br>
        <span style="color:green;">●</span> Correct Prediction<br>
        <span style="color:red;">●</span> Wrong Prediction
        </div>
        """
        m.get_root().html.add_child(folium.Element(legend_html))

        st.components.v1.html(m._repr_html_(), height=600)