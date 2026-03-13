import pandas as pd
import streamlit as st

@st.cache_data
def load_data(file):
    if file.name.endswith(".csv"):
        df = pd.read_csv(file)
    else:
        df = pd.read_excel(file)

    if "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df["hour"] = df["Date"].dt.hour
        df["month"] = df["Date"].dt.month

        midnight_mask = (
            (df["Date"].dt.hour == 0) &
            (df["Date"].dt.minute == 0) &
            (df["Date"].dt.second == 0)
        )
        midday_mask = (
            (df["Date"].dt.hour == 12) &
            (df["Date"].dt.minute == 0) &
            (df["Date"].dt.second == 0)
        )
        df.loc[midnight_mask | midday_mask, "hour"] = pd.NA

    df = df.dropna(subset=["hour", "Latitude", "Longitude", "Description"])
    df["hour"] = df["hour"].astype(int)
    return df