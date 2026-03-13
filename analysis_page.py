import streamlit as st
import pandas as pd
import plotly.express as px
import folium
from folium.plugins import HeatMap

def show_analysis_page(df, district_table_df):

    # ---------------- Title for Analysis Section ----------------
    st.markdown("""
    <h2 style="text-align:center;">
    Data Result Analysis (Chicago)
    </h2>
    <hr>
    """, unsafe_allow_html=True)

    # ---------------- Section 1 ----------------
    st.header(" Dataset Overview")

    overall_counts = df.groupby("Description").size().reset_index(name="count").sort_values(by="count", ascending=False)

    fig_overall = px.bar(
        overall_counts,
        x="Description",
        y="count",
        labels={"Description": "Crime Type", "count": "Number of Cases"},
        title="Overall Frequency of All Crimes by Description",
        hover_data={"Description": True, "count": True}
    )
    st.plotly_chart(fig_overall, use_container_width=True)

    # ---------------- Section 2 ----------------
    st.header("Cyber Crime Analysis")

    crime_types = sorted(df["Description"].unique())
    selected_crime = st.selectbox("Select Crime Category", crime_types)

    crime_df = df[df["Description"] == selected_crime]

    col1, col2 = st.columns(2)

    with col1:
        st.subheader(f"Overall {selected_crime} in the City of Chicago")
        center = [crime_df["Latitude"].mean(), crime_df["Longitude"].mean()]

        m1 = folium.Map(location=center, zoom_start=11)
        HeatMap(crime_df[["Latitude", "Longitude"]].values.tolist(), radius=10, blur=8).add_to(m1)

        st.components.v1.html(m1._repr_html_(),height =450)

    with col2:
        st.subheader("Description")
        st.markdown(f"""
        **{selected_crime}** incidents show a non-uniform spatial distribution across Chicago.
        The heatmap indicates concentrated hotspot zones.
        """)

    # ---------------- Section 3 ----------------
    st.header(" Time-wise Analysis")

    hour_counts = crime_df.groupby("hour").size().reset_index(name="crime_count")
    all_hours = pd.DataFrame({"hour": range(24)})
    hour_counts_full = pd.merge(all_hours, hour_counts, on="hour", how="left").fillna(0)

    fig_time = px.bar(
        hour_counts_full,
        x="hour",
        y="crime_count",
        labels={"hour": "Hour of Day", "crime_count": "Number of Incidents"},
        title=f"Time-wise {selected_crime} Report"
    )
    st.plotly_chart(fig_time, use_container_width=True)

    peak_hour = int(hour_counts_full.loc[hour_counts_full["crime_count"].idxmax(), "hour"])

    # ---------------- Section 4 ----------------
    st.header(" Time-wise Spatial Analysis")

    selected_hour = st.slider("Select Crime Time (Hour)", 0, 23, peak_hour)
    time_df = crime_df[crime_df["hour"] == selected_hour]

    col3, col4 = st.columns([2, 1])

    with col3:
        st.subheader(f"{selected_crime} at Time {selected_hour}:00")
        if len(time_df) == 0:
            st.warning("No data available for this hour.")
        else:
            center2 = [time_df["Latitude"].mean(), time_df["Longitude"].mean()]
            m2 = folium.Map(location=center2, zoom_start=11)
            HeatMap(time_df[["Latitude", "Longitude"]].values.tolist(), radius=8, blur=5).add_to(m2)
            st.components.v1.html(m2._repr_html_(), height=5000)

    with col4:
        st.subheader("Result & Discussion")
        if "District" in time_df.columns and len(time_df) > 0:
            top_districts = time_df["District"].value_counts().head(3).index.tolist()
            top_districts_str = ", ".join(map(str, top_districts))
        else:
            top_districts_str = "N/A"

        st.markdown(f"""
        At **{selected_hour}:00 hours**, **{selected_crime}** shows clusters.
        Highest concentration in districts: **{top_districts_str}**.  
        Peak hour is around **{peak_hour}:00**.
        """)

        st.markdown("---")
        st.subheader("Chicago Police District Reference")
        st.dataframe(district_table_df, use_container_width=True, hide_index=True, height=214)

    #with st.expander("📄Show Raw Data (First 1000 rows)"):
    #    st.dataframe(df.head(1000))