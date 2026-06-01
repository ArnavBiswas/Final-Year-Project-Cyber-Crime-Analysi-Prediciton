"""
Regression model registry for Future Crime Hotspot Prediction.

Follows the same Pipeline + StandardScaler structure as classification models
in react_api.py.
"""

from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, VotingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.tree import DecisionTreeRegressor

REGRESSION_MODEL_NAMES = [
    "Linear Regression",
    "SVR",
    "Decision Tree Regressor",
    "Random Forest Regressor",
    "Gradient Boosting Regressor",
    "MLP Regressor",
    "Voting Ensemble Regressor",
]


def _scaled(estimator):
    return Pipeline([("scaler", StandardScaler()), ("model", estimator)])


def regression_models():
    """Return all regression models for hotspot count forecasting."""
    linear_regression = _scaled(LinearRegression())
    svr = _scaled(SVR(kernel="rbf", C=10.0))
    cart = _scaled(DecisionTreeRegressor(max_depth=10, random_state=42))
    random_forest = _scaled(
        RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42)
    )
    gradient_boosting = _scaled(GradientBoostingRegressor(random_state=42))
    mlp = _scaled(MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=400, random_state=42))

    models = {
        "Linear Regression": linear_regression,
        "SVR": svr,
        "Decision Tree Regressor": cart,
        "Random Forest Regressor": random_forest,
        "Gradient Boosting Regressor": gradient_boosting,
        "MLP Regressor": mlp,
    }

    # Separate pipeline instances so voting ensemble does not share fitted state
    models["Voting Ensemble Regressor"] = VotingRegressor(
        estimators=[
            ("lr", _scaled(LinearRegression())),
            ("svr", _scaled(SVR(kernel="rbf", C=10.0))),
            ("dt", _scaled(DecisionTreeRegressor(max_depth=10, random_state=42))),
        ]
    )
    return models
