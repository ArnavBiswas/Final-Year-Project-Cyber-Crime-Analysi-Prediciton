const { useEffect, useMemo, useRef, useState } = React;

const DEFAULT_MODELS = [
  "Naive Bayes",
  "Logistic Regression",
  "SVM",
  "Decision Tree",
  "Random Forest",
  "Gradient Boosting",
  "MLP",
  "Voting Ensemble (LR+SVM+DT)",
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function formatChartValue(value, decimals = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (decimals > 0) return numeric.toFixed(decimals);
  return formatNumber(Math.round(numeric));
}

function useSystemTheme() {
  const [isDark, setIsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDark;
}

function chartTheme() {
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: styles.getPropertyValue("--chart-grid").trim() || "#d9deea",
    pieStroke: styles.getPropertyValue("--panel").trim() || "#ffffff",
  };
}

function shortModelName(name) {
  const names = {
    "Naive Bayes": "NB",
    "Logistic Regression": "LR",
    SVM: "SVM",
    "Decision Tree": "DT",
    "Random Forest": "RF",
    "Gradient Boosting": "GB",
    MLP: "MLP",
    "Voting Ensemble (LR+SVM+DT)": "Ensemble",
  };
  return names[name] || name;
}

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DatasetUploadCard({ onUpload, uploading, fileName, statusMessage, hasData }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const suppressCardClickRef = useRef(false);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file || uploading) return;
    onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openPicker() {
    if (uploading) return;
    inputRef.current?.click();
  }

  function onDragOver(event) {
    event.preventDefault();
    if (!uploading) setDragOver(true);
  }

  function onDragLeave(event) {
    event.preventDefault();
    setDragOver(false);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div
      className={`dataset-upload-card${dragOver ? " drag-over" : ""}${uploading ? " uploading" : ""}${hasData ? " has-data" : ""}`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (suppressCardClickRef.current) {
          suppressCardClickRef.current = false;
          return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest("button, input, a, label")) return;
        openPicker();
      }}
      onKeyDown={(event) => {
        if (uploading) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="upload-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="M8 8l4-4 4 4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </div>

      <span className="upload-card-eyebrow">Dataset</span>
      <h3>Upload Crime Dataset</h3>
      <p className="upload-card-copy">
        Drag and drop your raw Chicago crime file here, or choose a file from your computer.
      </p>

      <div className="upload-format-badges">
        <span className="pill">CSV</span>
        <span className="pill">Excel (.xlsx)</span>
      </div>

      <button
        type="button"
        className="primary upload-card-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          suppressCardClickRef.current = true;
          openPicker();
        }}
        disabled={uploading}
      >
        {uploading ? "Cleaning dataset..." : hasData ? "Replace dataset" : "Choose file"}
      </button>

      <p className="upload-card-note muted">Missing values, invalid dates, and duplicate rows are cleaned automatically.</p>

      {uploading && (
        <div className="upload-progress" role="status">
          <span className="upload-spinner" />
          Processing and validating records...
        </div>
      )}

      {!uploading && fileName && (
        <p className="upload-file-name">
          <strong>{hasData ? "Loaded file" : "Selected file"}:</strong> {fileName}
        </p>
      )}

      {!uploading && statusMessage && (
        <p className={`upload-status${statusMessage.includes("failed") ? " upload-status-error" : ""}`}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}

function ChartView({ type, labels, datasets, indexAxis = "x", xLabel = "", yLabel = "", valueDecimals = 0 }) {
  const [tooltip, setTooltip] = useState(null);
  const isDark = useSystemTheme();
  const { grid: gridColor, pieStroke } = chartTheme();
  const width = 900;
  const height = 310;
  const values = datasets.flatMap((dataset) => dataset.data);
  const maxValue = Math.max(...values, 1);
  const scaleMax = maxValue * 1.12;
  const showTooltip = (event, text) => {
    setTooltip({ x: event.clientX + 12, y: event.clientY + 12, text });
  };
  const hideTooltip = () => setTooltip(null);

  function withTooltip(label, value, extra = "") {
    const suffix = extra ? ` ${extra}` : "";
    return `${label}: ${formatChartValue(value, valueDecimals)}${suffix}`;
  }

  if (type === "doughnut" || type === "pie") {
    const dataset = datasets[0];
    const total = dataset.data.reduce((sum, value) => sum + value, 0) || 1;
    const slices = labels.map((label, index) => {
      const value = Number(dataset.data[index] || 0);
      const start = dataset.data.slice(0, index).reduce((sum, item) => sum + Number(item || 0), 0);
      const end = start + value;
      return {
        label,
        value,
        index,
        start,
        end,
        pct: (value / total) * 100,
        midAngle: ((start + value / 2) / total) * Math.PI * 2 - Math.PI / 2,
      };
    });

    function arcPath(slice) {
      const start = (slice.start / total) * Math.PI * 2 - Math.PI / 2;
      const end = (slice.end / total) * Math.PI * 2 - Math.PI / 2;
      const largeArc = end - start > Math.PI ? 1 : 0;
      const cx = 180;
      const cy = 150;
      const outer = 132;
      const inner = type === "doughnut" ? 64 : 0;
      const sx = cx + outer * Math.cos(start);
      const sy = cy + outer * Math.sin(start);
      const ex = cx + outer * Math.cos(end);
      const ey = cy + outer * Math.sin(end);
      const isx = cx + inner * Math.cos(end);
      const isy = cy + inner * Math.sin(end);
      const iex = cx + inner * Math.cos(start);
      const iey = cy + inner * Math.sin(start);

      if (inner === 0) {
        return `M ${cx} ${cy} L ${sx} ${sy} A ${outer} ${outer} 0 ${largeArc} 1 ${ex} ${ey} Z`;
      }

      return `M ${sx} ${sy} A ${outer} ${outer} 0 ${largeArc} 1 ${ex} ${ey} L ${isx} ${isy} A ${inner} ${inner} 0 ${largeArc} 0 ${iex} ${iey} Z`;
    }

    function sliceLabelPosition(slice) {
      const cx = 180;
      const cy = 150;
      const radius = type === "doughnut" ? 98 : 88;
      return {
        x: cx + radius * Math.cos(slice.midAngle),
        y: cy + radius * Math.sin(slice.midAngle),
      };
    }

    return (
      <div className="chart-shell">
        {tooltip && <div className="hover-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
        <div className="svg-chart pie-layout">
        <svg viewBox="0 0 360 300" role="img">
          {slices.map((slice) => (
            <path
              className="chart-hotspot"
              key={slice.label}
              d={arcPath(slice)}
              fill={dataset.backgroundColor[slice.index]}
              stroke={pieStroke}
              strokeWidth="2"
              onMouseMove={(event) => showTooltip(
                event,
                `${slice.label}: ${formatChartValue(slice.value, valueDecimals)} (${slice.pct.toFixed(1)}%)`,
              )}
              onMouseLeave={hideTooltip}
            />
          ))}
          {slices.filter((slice) => slice.pct >= 4).map((slice) => {
            const pos = sliceLabelPosition(slice);
            return (
              <text
                key={`${slice.label}-value`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="chart-value-label pie-slice-label"
              >
                {formatChartValue(slice.value, valueDecimals)}
              </text>
            );
          })}
        </svg>
        <div className="legend-list">
          {slices.map((slice) => (
            <span
              key={slice.label}
              className="legend-item-with-value"
              onMouseMove={(event) => showTooltip(
                event,
                `${slice.label}: ${formatChartValue(slice.value, valueDecimals)} (${slice.pct.toFixed(1)}%)`,
              )}
              onMouseLeave={hideTooltip}
            >
              <i style={{ background: dataset.backgroundColor[slice.index] }} />
              <span className="legend-item-text">
                <strong>{slice.label}</strong>
                <em>{formatChartValue(slice.value, valueDecimals)} · {slice.pct.toFixed(1)}%</em>
              </span>
            </span>
          ))}
        </div>
      </div>
      </div>
    );
  }

  if (type === "line") {
    const palette = ["#2563eb", "#0f766e", "#dc2626", "#9333ea"];
    const allValues = datasets.flatMap((dataset) => dataset.data);
    const lineScaleMax = Math.max(...allValues, 1) * 1.12;
    const showAllPointLabels = labels.length <= 18;

    return (
      <div className="chart-shell">
        {tooltip && <div className="hover-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
        {datasets.length > 1 && (
          <div className="chart-legend">
            {datasets.map((dataset, index) => (
              <span key={dataset.label}>
                <i style={{ background: dataset.borderColor || palette[index % palette.length] }} />
                {dataset.label}
              </span>
            ))}
          </div>
        )}
        <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1="45" y1="20" x2="45" y2={height - 42} stroke={gridColor} />
        <line x1="45" y1={height - 42} x2={width - 20} y2={height - 42} stroke={gridColor} />
        {yLabel && <text className="axis-label" x="15" y={height / 2} transform={`rotate(-90 15 ${height / 2})`} textAnchor="middle">{yLabel}</text>}
        {xLabel && <text className="axis-label" x={width / 2} y={height - 2} textAnchor="middle">{xLabel}</text>}
        {datasets.map((dataset, datasetIndex) => {
          const stroke = dataset.borderColor || palette[datasetIndex % palette.length];
          const points = dataset.data.map((value, index) => {
            const x = 50 + (index / Math.max(dataset.data.length - 1, 1)) * (width - 90);
            const y = height - 45 - (value / lineScaleMax) * (height - 80);
            return `${x},${y}`;
          });
          return (
            <g key={dataset.label}>
              <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth="3" pointerEvents="none" />
              {dataset.data.map((value, index) => {
                const x = 50 + (index / Math.max(dataset.data.length - 1, 1)) * (width - 90);
                const y = height - 45 - (value / lineScaleMax) * (height - 80);
                const showLabel = showAllPointLabels || index % Math.max(Math.ceil(labels.length / 8), 1) === 0;
                return (
                  <g key={`${dataset.label}-${labels[index]}`}>
                    <circle
                      className="chart-hotspot"
                      cx={x}
                      cy={y}
                      r="6"
                      fill={stroke}
                      onMouseMove={(event) => showTooltip(event, withTooltip(`${dataset.label} ${labels[index]}`, value, "cases"))}
                      onMouseLeave={hideTooltip}
                    />
                    {showLabel && (
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        className="chart-value-label"
                      >
                        {formatChartValue(value, valueDecimals || 1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {labels.map((label, index) => (
          index % Math.max(Math.ceil(labels.length / 8), 1) === 0 ? <text key={label} x={50 + (index / Math.max(labels.length - 1, 1)) * (width - 90)} y={height - 18} textAnchor="middle">{label}</text> : null
        ))}
      </svg>
      </div>
    );
  }

  const vertical = indexAxis === "y";
  const datasetCount = datasets.length;
  return (
    <div className="chart-shell">
      {tooltip && <div className="hover-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
      {datasets.length > 1 && (
        <div className="chart-legend">
          {datasets.map((dataset) => (
            <span key={dataset.label}>
              <i style={{ background: dataset.backgroundColor || "#2563eb" }} />
              {dataset.label}
            </span>
          ))}
        </div>
      )}
      <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1="45" y1="20" x2="45" y2={height - 52} stroke={gridColor} />
      <line x1="45" y1={height - 52} x2={width - 20} y2={height - 52} stroke={gridColor} />
      {yLabel && <text className="axis-label" x="15" y={height / 2} transform={`rotate(-90 15 ${height / 2})`} textAnchor="middle">{yLabel}</text>}
      {xLabel && <text className="axis-label" x={width / 2} y={height - 2} textAnchor="middle">{xLabel}</text>}
      {!vertical &&
        labels.map((label, labelIndex) => {
          const groupWidth = (width - 90) / labels.length;
          return datasets.map((dataset, datasetIndex) => {
            const barWidth = Math.max(groupWidth / datasetCount - 8, 8);
            const value = dataset.data[labelIndex] || 0;
            const barHeight = (value / scaleMax) * (height - 88);
            const x = 52 + labelIndex * groupWidth + datasetIndex * (barWidth + 4);
            const y = height - 52 - barHeight;
            return (
              <g key={`${dataset.label}-${label}`}>
                <rect
                  className="chart-hotspot"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={dataset.backgroundColor || "#2563eb"}
                  onMouseMove={(event) => showTooltip(event, withTooltip(`${dataset.label} ${label}`, value))}
                  onMouseLeave={hideTooltip}
                />
                {barHeight > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(y - 6, 16)}
                    textAnchor="middle"
                    className="chart-value-label"
                  >
                    {formatChartValue(value, valueDecimals)}
                  </text>
                )}
              </g>
            );
          });
        })}
      {vertical &&
        labels.map((label, index) => {
          const rowHeight = (height - 72) / labels.length;
          const value = datasets[0].data[index] || 0;
          const barWidth = (value / scaleMax) * (width - 250);
          const barY = 22 + index * rowHeight;
          return (
            <g key={label}>
              <text x="48" y={34 + index * rowHeight} dominantBaseline="middle">{label}</text>
              <rect
                className="chart-hotspot"
                x="170"
                y={barY}
                width={barWidth}
                height={Math.max(rowHeight - 8, 8)}
                rx="4"
                fill={datasets[0].backgroundColor || "#2563eb"}
                onMouseMove={(event) => showTooltip(event, withTooltip(label, value, "cases"))}
                onMouseLeave={hideTooltip}
              />
              <text
                x={170 + barWidth + 8}
                y={barY + Math.max(rowHeight - 8, 8) / 2}
                dominantBaseline="middle"
                className="chart-value-label"
              >
                {formatChartValue(value, valueDecimals)}
              </text>
            </g>
          );
        })}
      {!vertical &&
        labels.map((label, index) => (
          index % Math.ceil(labels.length / 8) === 0 ? <text key={label} x={60 + index * ((width - 90) / labels.length)} y={height - 20} textAnchor="middle">{label.length > 13 ? `${label.slice(0, 12)}...` : label}</text> : null
        ))}
    </svg>
    </div>
  );
}

function Section({ eyebrow, title, description, children }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        {eyebrow && <span>{eyebrow}</span>}
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function PieChartView({ rows }) {
  const palette = ["#2563eb", "#0f766e", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#4f46e5", "#65a30d"];
  const topRows = rows.slice(0, 7);
  const otherTotal = rows.slice(7).reduce((sum, row) => sum + row.count, 0);
  const pieRows = otherTotal > 0 ? [...topRows, { Description: "Other", count: otherTotal }] : topRows;

  return (
    <ChartView
      type="doughnut"
      labels={pieRows.map((row) => row.Description)}
      datasets={[
        {
          label: "Cases",
          data: pieRows.map((row) => row.count),
          backgroundColor: pieRows.map((_, index) => palette[index % palette.length]),
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ]}
    />
  );
}

function riskColor(level) {
  if (level === "HIGH") return "#dc2626";
  if (level === "MEDIUM") return "#eab308";
  return "#16a34a";
}

function MapView({ points, color = "#0f766e" }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!nodeRef.current || !window.L) return;

    if (!mapRef.current) {
      mapRef.current = L.map(nodeRef.current, { scrollWheelZoom: false }).setView([41.8781, -87.6298], 10);
    }

    if (tileRef.current) {
      tileRef.current.remove();
    }

    tileRef.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
      }
    ).addTo(mapRef.current);

    if (layerRef.current) {
      layerRef.current.remove();
    }

    const valid = (points || []).filter((point) => point.Latitude && point.Longitude);
    layerRef.current = L.layerGroup().addTo(mapRef.current);

    valid.slice(0, 900).forEach((point) => {
      const markerColor = point.Risk_Level ? riskColor(point.Risk_Level) : typeof color === "function" ? color(point) : color;
      const tooltipParts = [
        point.District_Name ? `District: ${point.District_Name}${point.District ? ` (${point.District})` : ""}` : null,
        point.Prediction_Month ? `Prediction Month: ${point.Prediction_Month}` : null,
        point.Prediction_Year ? `Prediction Year: ${point.Prediction_Year}` : null,
        point.Expected_Crime_Count !== undefined ? `Expected Crime Count: ${point.Expected_Crime_Count}` : null,
        point.Risk_Score !== undefined ? `Risk Score: ${point.Risk_Score}` : null,
        point.Risk_Level ? `Risk Level: ${point.Risk_Level}` : null,
        point.Predicted_District ? `Predicted: ${point.Predicted_District}` : null,
        point.Is_Correct !== undefined ? `Status: ${point.Is_Correct ? "Correct" : "Wrong"}` : null,
        point.hour !== undefined ? `Hour: ${point.hour}:00` : null,
      ].filter(Boolean);

      L.circleMarker([point.Latitude, point.Longitude], {
        radius: point.Risk_Level ? 10 : 7,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.75,
        weight: 1,
      })
        .bindTooltip(tooltipParts.join("<br>"), { sticky: true, direction: "top", opacity: 0.95 })
        .addTo(layerRef.current);
    });

    if (valid.length) {
      const bounds = L.latLngBounds(valid.slice(0, 900).map((point) => [point.Latitude, point.Longitude]));
      mapRef.current.fitBounds(bounds, { padding: [18, 18] });
    }
  }, [points, color]);

  return <div className="map" ref={nodeRef} />;
}

function DataTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="muted">No rows available.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CleaningReport({ cleaning }) {
  if (!cleaning) return null;

  const issueRows = (cleaning.issues || []).filter((issue) => issue.Count > 0);

  return (
    <Section
      eyebrow="Clean"
      title="Raw Dataset Cleaning Report"
      description="The uploaded raw file is inspected for missing values, invalid dates, invalid coordinates, duplicate rows, placeholder times, and unusable district values before analysis."
    >
      <div className="grid cleaning-grid">
        <Stat label="Original rows" value={formatNumber(cleaning.originalRows)} />
        <Stat label="Clean usable rows" value={formatNumber(cleaning.cleanRows)} />
        <Stat label="Rows removed" value={formatNumber(cleaning.removedRows)} />
        <Stat label="Issues detected" value={formatNumber(issueRows.reduce((sum, row) => sum + row.Count, 0))} />
      </div>
      <div className="card compact-table-card">
        <h3>Detected Data Quality Issues</h3>
        {issueRows.length ? <DataTable rows={issueRows} /> : <p className="muted">No major data quality issues were detected.</p>}
      </div>
    </Section>
  );
}

function Home({ onUpload, uploading, message, hasData, fileName }) {
  return (
    <section className="hero-layout">
      <div className="hero-content">
        <h2>A Hybrid Machine Learning Framework for Geospatial Cyber Crime Prediction and Demographic Pattern Analysis</h2>
        <p>
          Upload the raw Chicago crime dataset. The system cleans missing and invalid records, then prepares the usable
          dataset for spatial analysis, temporal analysis, and machine learning prediction.
        </p>
        <div className="hero-meta">
          <span className="pill">Geospatial analysis</span>
          <span className="pill">Temporal patterns</span>
          <span className="pill">Machine learning</span>
          <span className="pill">Future hotspot prediction</span>
        </div>
      </div>

      <DatasetUploadCard
        onUpload={onUpload}
        uploading={uploading}
        fileName={fileName}
        statusMessage={message}
        hasData={hasData}
      />
    </section>
  );
}

function Overview({ data }) {
  if (!data) {
    return <div className="message">Upload a raw CSV or Excel dataset. The app will clean it before opening the dashboard.</div>;
  }

  return (
    <div className="grid">
      <div className="grid stats">
        <Stat label="Original rows" value={formatNumber(data.cleaning?.originalRows || data.rows)} />
        <Stat label="Clean rows" value={formatNumber(data.rows)} />
        <Stat label="Crime categories" value={formatNumber(data.summary.crimeTypes)} />
        <Stat label="Rows removed" value={formatNumber(data.cleaning?.removedRows || 0)} />
      </div>

      <CleaningReport cleaning={data.cleaning} />

      <Section
        eyebrow="Overview"
        title="Crime Distribution"
        description="This section summarizes how cybercrime cases are distributed across major crime categories in the cleaned dataset."
      >
        <div className="grid overview-grid">
          <div className="card">
            <h3>Crime Category Share</h3>
            <div className="chart pie-chart">
              <PieChartView rows={data.charts.descriptionCounts} />
            </div>
          </div>

          <div className="card">
            <h3>Top Crime Categories</h3>
            <div className="chart">
              <ChartView
                type="bar"
                labels={data.charts.descriptionCounts.map((row) => row.Description)}
                datasets={[{ label: "Cases", data: data.charts.descriptionCounts.map((row) => row.count), backgroundColor: "#2563eb" }]}
                xLabel="Crime category"
                yLabel="Number of cases"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Dataset"
        title="Cleaned Dataset Overview"
        description="A compact preview of the cleaned and usable records generated from the uploaded raw dataset."
      >
        <div className="card">
          <p className="muted table-note">
            {data.raw.columns.length} columns detected after cleaning. Date range: {data.summary.dateMin || "-"} to {data.summary.dateMax || "-"}.
            Showing the first 20 usable rows.
          </p>
          <DataTable rows={data.raw.preview} />
        </div>
      </Section>

      <Section
        eyebrow="Reference"
        title="Chicago Police Districts"
        description="District number and district name reference used to interpret spatial and prediction outputs."
      >
        <div className="card compact-table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>District</th>
                </tr>
              </thead>
              <tbody>
                {data.districtReference.map((row) => (
                  <tr key={row["District No"]}>
                    <td>{row["District No"]}</td>
                    <td>{row["District Name"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Analysis({ data }) {
  const [crime, setCrime] = useState("");
  const [hour, setHour] = useState("");
  const [debouncedHour, setDebouncedHour] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (data?.crimeTypes?.length && !crime) {
      setCrime(data.crimeTypes[0]);
    }
  }, [data, crime]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHour(hour), 400);
    return () => clearTimeout(timer);
  }, [hour]);

  useEffect(() => {
    if (!crime) return;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ crime });
    if (debouncedHour !== "") query.set("hour", debouncedHour);
    fetch(`/api/analysis?${query.toString()}`)
      .then((res) => res.json().then((body) => (res.ok ? body : Promise.reject(body))))
      .then(setAnalysis)
      .catch((err) => setError(err.error || "Could not load analysis."))
      .finally(() => setLoading(false));
  }, [crime, debouncedHour]);

  if (!data) {
    return <div className="message">Upload a raw dataset first. The app will clean it before analysis.</div>;
  }

  return (
    <div className="grid">
      <div className="controls">
        <div className="field">
          <label>Crime category</label>
          <select value={crime} onChange={(event) => setCrime(event.target.value)}>
            {data.crimeTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Hour</label>
          <input min="0" max="23" type="number" value={hour} placeholder="Peak" onChange={(event) => setHour(event.target.value)} />
        </div>
      </div>

      {error && <div className="message error">{error}</div>}
      {loading && <div className="message">Loading analysis...</div>}

      {analysis && (
        <>
          <div className="grid stats">
            <Stat label="Selected records" value={formatNumber(analysis.records)} />
            <Stat label="Peak hour" value={`${analysis.peakHour}:00`} />
            <Stat label="Viewed hour" value={`${analysis.selectedHour}:00`} />
            <Stat label="Mapped points" value={formatNumber(analysis.mapPoints.length)} />
          </div>

          {analysis.highestRiskDistrict && (
            <div className="card highest-risk-card">
              <span className="muted">Highest Risk District</span>
              <strong>
                {analysis.highestRiskDistrict.highest_risk_district
                  ? `District ${analysis.highestRiskDistrict.highest_risk_district}${analysis.highestRiskDistrict.district_name ? ` - ${analysis.highestRiskDistrict.district_name}` : ""}`
                  : analysis.highestRiskDistrict.district_name || "—"}
              </strong>
              <p className="highest-risk-meta">
                {formatNumber(analysis.highestRiskDistrict.crime_count)} crimes | {Number(analysis.highestRiskDistrict.risk_percentage).toFixed(1)}% risk
              </p>
            </div>
          )}

          <Section
            eyebrow="1"
            title="District-wise Analysis"
            description="Shows which police districts have the highest number of incidents for the selected crime category."
          >
            <div className="card">
              <div className="chart chart-medium">
                <ChartView
                  type="bar"
                  indexAxis="y"
                  labels={analysis.topDistricts.map((row) => row.district)}
                  datasets={[{ label: "Cases", data: analysis.topDistricts.map((row) => row.count), backgroundColor: "#2563eb" }]}
                  xLabel="Number of cases"
                  yLabel="District"
                />
              </div>
            </div>
          </Section>

          <Section
            eyebrow="2"
            title="Spatial Analysis"
            description="Plots incident locations to reveal geographical clustering and hotspot areas for the selected crime."
          >
            <div className="card">
              <MapView points={analysis.mapPoints} />
            </div>
          </Section>

          <Section
            eyebrow="3"
            title="Temporal Analysis"
            description="Compares incident frequency across all 24 hours to identify peak reporting periods."
          >
            <div className="card">
              <div className="chart chart-medium">
                <ChartView
                  type="bar"
                  labels={analysis.hourlyCounts.map((row) => `${row.hour}:00`)}
                  datasets={[{ label: "Cases", data: analysis.hourlyCounts.map((row) => row.count), backgroundColor: "#0f766e" }]}
                  xLabel="Hour of day"
                  yLabel="Number of cases"
                />
              </div>
            </div>
          </Section>

          <Section
            eyebrow="4"
            title="Time-wise Spatial Analysis"
            description="Filters the spatial map by the selected hour to compare how hotspots change over time."
          >
            <div className="grid two">
              <div className="card">
                <MapView points={analysis.hourMapPoints} color="#dc2626" />
              </div>
              <div className="card compact-table-card">
                <h3>Selected-hour District Concentration</h3>
                <DataTable rows={analysis.hourTopDistricts} />
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function MachineLearning({ data }) {
  const [crime, setCrime] = useState("");
  const [model, setModel] = useState("Random Forest");
  const [modelNames, setModelNames] = useState(DEFAULT_MODELS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((body) => {
        if (body.models?.length) setModelNames(body.models);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (data?.crimeTypes?.length && !crime) {
      setCrime(data.crimeTypes[0]);
    }
  }, [data, crime]);

  function train() {
    setLoading(true);
    setError("");
    setResult(null);
    fetch("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crime, model }),
    })
      .then((res) => res.json().then((body) => (res.ok ? body : Promise.reject(body))))
      .then(setResult)
      .catch((err) => setError(err.error || "Training failed."))
      .finally(() => setLoading(false));
  }

  if (!data) {
    return <div className="message">Upload a raw dataset first. The app will clean it before model training.</div>;
  }

  return (
    <div className="grid">
      <div className="controls">
        <div className="field">
          <label>Crime category</label>
          <select value={crime} onChange={(event) => setCrime(event.target.value)}>
            {data.crimeTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Model</label>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {modelNames.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <button className="primary" onClick={train} disabled={loading}>
          {loading ? "Training..." : "Train Model"}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      {result && (
        <>
          <div className="grid stats">
            <Stat label="Selected model" value={result.selected.model} />
            <Stat label="Accuracy" value={`${result.selected.accuracy.toFixed(2)}%`} />
            <Stat label="Precision" value={`${(result.selected.precision ?? 0).toFixed(2)}%`} />
            <Stat label="Recall" value={`${(result.selected.recall ?? 0).toFixed(2)}%`} />
            <Stat label="F1 score" value={`${(result.selected.f1 ?? 0).toFixed(2)}%`} />
            <Stat label="Crime category" value={result.crime} />
          </div>

          <Section
            eyebrow="Model"
            title="Machine Learning Model Comparison"
            description="Weighted precision, recall, F1-score, and accuracy across all classifiers for the selected crime category."
          >
          <div className="card">
            <div className="chart">
              <ChartView
                type="bar"
                labels={result.comparison.map((row) => shortModelName(row.Model))}
                valueDecimals={2}
                datasets={[
                  { label: "Accuracy", data: result.comparison.map((row) => row.Accuracy), backgroundColor: "#2563eb" },
                  { label: "Precision", data: result.comparison.map((row) => row.Precision), backgroundColor: "#9333ea" },
                  { label: "Recall", data: result.comparison.map((row) => row.Recall), backgroundColor: "#dc2626" },
                  { label: "F1", data: result.comparison.map((row) => row.F1), backgroundColor: "#0f766e" },
                ]}
                xLabel="Machine learning model"
                yLabel="Score (%)"
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Accuracy</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparison.map((row) => (
                    <tr key={row.Model}>
                      <td>{row.Model}</td>
                      <td>{row.Accuracy.toFixed(2)}%</td>
                      <td>{row.Precision.toFixed(2)}%</td>
                      <td>{row.Recall.toFixed(2)}%</td>
                      <td>{row.F1.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </Section>

          <Section
            eyebrow="District"
            title="District Evaluation Report"
            description="Per-district precision, recall, F1-score, and support for the selected model (district-level breakdown)."
          >
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {result.selected.report.map((row) => (
                    <tr key={row.District}>
                      <td>{row.District}</td>
                      <td>{row.Precision.toFixed(2)}%</td>
                      <td>{row.Recall.toFixed(2)}%</td>
                      <td>{row.F1.toFixed(2)}%</td>
                      <td>{row.Support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </Section>

          <Section
            eyebrow="Map"
            title="Predicted District Map"
            description="Displays each incident location with green markers for correct district predictions and red markers for incorrect predictions."
          >
          <div className="card">
            <p className="muted table-note">Green points are correct predictions and red points are incorrect predictions.</p>
            <MapView points={result.predictionMap} color={(point) => (point.Is_Correct ? "#16a34a" : "#dc2626")} />
          </div>
          </Section>
        </>
      )}
    </div>
  );
}

function RiskBadge({ level }) {
  const tone = (level || "LOW").toLowerCase();
  return <span className={`risk-badge risk-${tone}`}>{level || "LOW"}</span>;
}

function hotspotModelMetrics(result, modelName) {
  if (!result || !modelName) return null;
  const fromEvaluation = result.evaluation?.[modelName];
  if (fromEvaluation) return fromEvaluation;
  return result.comparison?.find((row) => row.Model === modelName) || null;
}

function formatPredictedCrimes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toFixed(1);
}

async function readApiResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}). Restart python react_api.py, then hard-refresh the page (Ctrl+Shift+R).`);
  }
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

function FutureCrimePrediction({ data }) {
  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const [districts, setDistricts] = useState([]);
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [district, setDistrict] = useState("");
  const [crime, setCrime] = useState("");
  const [month, setMonth] = useState("8");
  const [year, setYear] = useState("2026");
  const [activeModel, setActiveModel] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelSwitching, setModelSwitching] = useState(false);
  const [error, setError] = useState("");
  const forecastRequestRef = useRef(0);

  useEffect(() => {
    if (!data) return;
    fetch("/api/hotspot/options")
      .then((res) => res.json().then((body) => (res.ok ? body : Promise.reject(body))))
      .then((body) => {
        setDistricts(body.districts || []);
        setCrimeTypes(body.crimeTypes || data.crimeTypes || []);
        setDistrict(String(body.defaultDistrict || 11));
        setCrime(body.defaultCrime || data.crimeTypes?.[0] || "");
        setMonth(String(body.defaultMonth || 8));
        setYear(String(body.defaultYear || 2026));
        setActiveModel(body.selectedModel || "");
      })
      .catch((err) => setError(err.error || "Could not load hotspot options."));
  }, [data]);

  useEffect(() => {
    // If crime category changes, reset stale model/result from previous crime.
    setResult(null);
    setActiveModel("");
  }, [crime]);

  function runForecast({ modelOverride, switchOnly = false } = {}) {
    if (!district || !crime) {
      setError("Select a crime category and district first.");
      return;
    }

    const requestId = forecastRequestRef.current + 1;
    forecastRequestRef.current = requestId;
    setLoading(true);
    setModelSwitching(Boolean(switchOnly));
    setError("");

    const payload = {
      district: Number(district),
      month: Number(month),
      year: Number(year),
      crime,
    };
    const resultFromSameCrime = result?.crime === crime ? result : null;
    const chosenModel = modelOverride || (switchOnly ? (resultFromSameCrime?.activeModel || resultFromSameCrime?.model) : undefined);
    if (chosenModel) payload.model = chosenModel;

    fetch("/api/hotspot/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        district: Number(district),
        month: Number(month),
        year: Number(year),
        crime,
        model: chosenModel,
        lightweight: Boolean(switchOnly),
      }),
    })
      .then(readApiResponse)
      .then((body) => {
        if (forecastRequestRef.current !== requestId) return;
        setResult(body);
        setActiveModel(body.activeModel || body.model || "");
      })
      .catch((err) => {
        if (forecastRequestRef.current !== requestId) return;
        setError(err.message || err.error || "Hotspot prediction failed.");
      })
      .finally(() => {
        if (forecastRequestRef.current !== requestId) return;
        setLoading(false);
        setModelSwitching(false);
      });
  }

  function predict() {
    runForecast();
  }

  function selectModel(modelName) {
    if (!result || !modelName || loading) return;
    const currentModel = result.activeModel || result.model;
    if (modelName === currentModel) return;
    if (result.evaluation?.[modelName]?.Error) {
      setError(`Model unavailable: ${result.evaluation[modelName].Error}`);
      return;
    }

    const requestId = forecastRequestRef.current + 1;
    forecastRequestRef.current = requestId;
    setModelSwitching(true);
    setLoading(true);
    setError("");

    setResult((prev) => ({
      ...prev,
      activeModel: modelName,
      model: modelName,
      selectedModelMetrics: hotspotModelMetrics(prev, modelName) || prev.selectedModelMetrics,
    }));

    fetch("/api/hotspot/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        district: Number(district),
        month: Number(month),
        year: Number(year),
        crime,
        model: modelName,
        lightweight: true,
      }),
    })
      .then(readApiResponse)
      .then((body) => {
        if (forecastRequestRef.current !== requestId) return;
        setResult((prev) => ({ ...prev, ...body }));
        setActiveModel(body.activeModel || body.model || modelName);
      })
      .catch((err) => {
        if (forecastRequestRef.current !== requestId) return;
        setError(err.message || err.error || "Could not switch regression model.");
        setResult((prev) => (prev ? { ...prev, activeModel: currentModel, model: currentModel } : prev));
        setActiveModel(currentModel || "");
      })
      .finally(() => {
        if (forecastRequestRef.current !== requestId) return;
        setLoading(false);
        setModelSwitching(false);
      });
  }

  if (!data) {
    return <div className="message">Upload a raw dataset first. The app will clean it before future hotspot prediction.</div>;
  }

  const bestModel = result?.selectedModel;
  const displayModel = result?.activeModel || result?.model || "";
  const bestModelR2 = Number(
    hotspotModelMetrics(result, bestModel)?.R2
    ?? result?.bestModelMetrics?.R2
    ?? 0,
  );
  const activeModelR2 = Number(
    hotspotModelMetrics(result, displayModel)?.R2
    ?? result?.selectedModelMetrics?.R2
    ?? 0,
  );
  const evaluationRows = (result?.comparison?.length ? result.comparison : result
    ? Object.entries(result.evaluation || {}).map(([model, metrics]) => ({ Model: model, ...metrics }))
    : []
  ).map((row) => ({
    ...row,
    isBest: row.Model === bestModel,
    isActive: row.Model === displayModel,
    isUnavailable: Boolean(row.Error || result?.evaluation?.[row.Model]?.Error),
  }));

  return (
    <div className="grid">
      <Section
        eyebrow="Future"
        title="Future Crime Hotspot Prediction"
        description="Select a crime category, district, and month-year target. Train regression models on that crime type, then choose any evaluated model to update predictions and the actual vs predicted trend chart."
      >
        <div className="controls">
          <div className="field">
            <label>Crime category</label>
            <select value={crime} onChange={(event) => setCrime(event.target.value)}>
              {(crimeTypes.length ? crimeTypes : data.crimeTypes || []).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>District</label>
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              {districts.map((item) => (
                <option key={item.district} value={item.district}>
                  {item.district} — {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Month</label>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {monthOptions.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <input type="number" min="2001" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
          </div>
          <button className="primary" onClick={predict} disabled={loading || !district || !crime}>
            {loading ? "Predicting..." : "Predict Hotspot"}
          </button>
        </div>
      </Section>

      {error && <div className="message error">{error}</div>}
      {loading && (
        <div className="message">
          {modelSwitching
            ? "Updating forecast with the selected regression model..."
            : "Training regression models and generating future hotspot forecast..."}
        </div>
      )}

      {result && (
        <>
          <div className="grid stats" key={`forecast-${displayModel}-${result.predicted_crimes}-${result.risk_score}`}>
            <Stat label="Crime category" value={result.crime || crime} />
            <Stat label="District" value={`${result.district} — ${result.district_name}`} />
            <Stat label="Predicted crimes" value={formatPredictedCrimes(result.predicted_crimes)} />
            <Stat label="Active model" value={displayModel || "—"} />
          </div>
          <div className="grid stats">
            <Stat label="Risk score" value={result.risk_score} />
            <div className="card stat">
              <span className="muted">Risk level</span>
              <strong><RiskBadge level={result.risk_level} /></strong>
            </div>
            <Stat label="Best model (R²)" value={`${bestModel || "—"} · ${bestModelR2.toFixed(4)}`} />
            <Stat label="Active model R²" value={activeModelR2.toFixed(4)} />
          </div>
          <p className="muted table-note">
            Click any row in <strong>Regression Model Evaluation</strong> to switch the active model and refresh predictions, map, and trend chart.
          </p>

          <div className="grid two">
            <div className="card risk-card">
              <h3>Forecast Summary</h3>
              <p className="muted table-note">
                Crime: {result.crime || crime}. Prediction target: {result.month_name} {result.year}. Active model: {displayModel}.
              </p>
              <div className="risk-summary">
                <div>
                  <span className="muted">Expected crime count</span>
                  <strong>{formatPredictedCrimes(result.predicted_crimes)}</strong>
                </div>
                <div>
                  <span className="muted">Risk score</span>
                  <strong>{result.risk_score}</strong>
                </div>
                <div>
                  <span className="muted">Risk level</span>
                  <RiskBadge level={result.risk_level} />
                </div>
              </div>
              <p className="muted table-note">
                Dynamic thresholds — LOW: ≤ {Math.round(result.riskThresholds?.low_max || 0)}, MEDIUM: ≤ {Math.round(result.riskThresholds?.medium_max || 0)}, HIGH: above medium band.
              </p>
            </div>

            <div className="card compact-table-card">
              <h3>Regression Model Evaluation</h3>
              <p className="muted table-note">★ = best R² · highlighted row = active model for predictions</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>MAE</th>
                      <th>RMSE</th>
                      <th>R2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationRows.map((row) => (
                      <tr
                        key={row.Model}
                        className={`model-select-row${row.isActive ? " active-model-row" : ""}${row.isBest ? " best-model-row" : ""}${row.isUnavailable ? " model-row-unavailable" : ""}${loading ? " model-select-row--busy" : ""}`}
                        onClick={() => !row.isUnavailable && selectModel(row.Model)}
                        title={row.isUnavailable ? "This model failed to train" : loading ? "Wait for the current forecast to finish" : "Use this model for predictions and trend chart"}
                      >
                        <td>{row.Model}{row.isBest ? " ★" : ""}{row.isActive ? " ✓" : ""}</td>
                        <td>{Number(row.MAE).toFixed(3)}</td>
                        <td>{Number(row.RMSE).toFixed(3)}</td>
                        <td>{Number(row.R2).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Section
            eyebrow="Trend"
            title="Actual Crime Trend vs Predicted Crime Trend"
            description={`Historical ${result.crime || crime} counts for district ${result.district_name} compared with predictions from ${displayModel}.`}
          >
            <div className="card">
              <div className="chart chart-medium">
                <ChartView
                  key={`${displayModel}-${result.predicted_crimes}-${(result.trend?.predicted || []).join(",")}`}
                  type="line"
                  labels={result.trend?.labels || []}
                  valueDecimals={1}
                  datasets={[
                    { label: `Actual (${result.crime || crime})`, data: result.trend?.actual || [], borderColor: "#2563eb" },
                    { label: `Predicted (${displayModel})`, data: result.trend?.predicted || [], borderColor: "#0f766e" },
                  ]}
                  xLabel="Month"
                  yLabel="Crime count"
                />
              </div>
            </div>
          </Section>

          <Section
            eyebrow="Map"
            title="Future Hotspot Map"
            description="Green markers indicate low future risk, yellow markers medium risk, and red markers high future risk."
          >
            <div className="card">
              <div className="legend-list map-legend">
                <span><i style={{ background: "#16a34a" }} /> LOW</span>
                <span><i style={{ background: "#eab308" }} /> MEDIUM</span>
                <span><i style={{ background: "#dc2626" }} /> HIGH</span>
              </div>
              <MapView key={`hotspot-map-${displayModel}`} points={result.mapPoints} />
            </div>
          </Section>

          <Section
            eyebrow="Districts"
            title="All District Future Predictions"
            description="Regression forecast and risk classification for every police district in the uploaded dataset."
          >
            <div className="card compact-table-card">
              <DataTable
                rows={(result.allDistrictPredictions || []).map((row) => ({
                  District: row.district,
                  Name: row.district_name,
                  Month: row.month_name,
                  Year: row.year,
                  Predicted_Crimes: Math.round(row.predicted_crimes),
                  Risk_Score: row.risk_score,
                  Risk_Level: row.risk_level,
                }))}
              />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function NavIcon({ type }) {
  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M6 9.5V21h12V9.5" />
        <path d="M10 21v-5h4v5" />
      </svg>
    );
  }
  if (type === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    );
  }
  if (type === "analysis") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
        <path d="M8.5 11h5" />
        <path d="M11 8.5v5" />
      </svg>
    );
  }
  if (type === "ml") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 8h8M8 12h8M8 16h5" />
        <circle cx="17.5" cy="16.5" r="2.2" />
      </svg>
    );
  }
  if (type === "future") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18l4-5 3 2 5-7 4 2" />
        <path d="M4 20h16" />
        <path d="M17 4l3 1-1 3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 10v6" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function App() {
  const [page, setPage] = useState("Home");
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const datasetSummary = useMemo(() => {
    if (!data) return null;
    return `${formatNumber(data.rows)} clean rows · ${formatNumber(data.summary?.crimeTypes || 0)} crime types · ${formatNumber(data.summary?.districts || 0)} districts`;
  }, [data]);

  const pageTitle = useMemo(() => {
    if (page === "Overview") return "Data Overview";
    if (page === "Analysis") return "Geospatial Analysis";
    if (page === "Machine Learning") return "Machine Learning";
    if (page === "Future Crime Prediction") return "Future Crime Prediction";
    if (page === "About Project") return "About Project";
    return "Project Home";
  }, [page]);

  const navItems = [
    { label: "Home", icon: "home", tone: "home" },
    { label: "Overview", icon: "overview", tone: "overview" },
    { label: "Analysis", icon: "analysis", tone: "analysis" },
    { label: "Machine Learning", icon: "ml", tone: "ml" },
    { label: "Future Crime Prediction", icon: "future", tone: "future" },
    { label: "About Project", icon: "about", tone: "about" },
  ];

  function uploadFile(fileOrEvent) {
    const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    setMessage("");
    setFileName(file.name);
    fetch("/api/upload", { method: "POST", body: form })
      .then((res) => res.json().then((body) => (res.ok ? body : Promise.reject(body))))
      .then((body) => {
        setData(body);
        setPage("Overview");
        setMessage(`Cleaned ${formatNumber(body.cleaning?.originalRows || body.rows)} raw rows into ${formatNumber(body.rows)} usable records.`);
      })
      .catch((err) => setMessage(err.error || "Upload failed."))
      .finally(() => setUploading(false));

    if (fileOrEvent?.target) {
      fileOrEvent.target.value = "";
    }
  }

  return (
    <div className={`app${sidebarCollapsed ? " app-sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>
        <div className="brand">
          <div
            className="brand-mark"
            role="button"
            tabIndex={0}
            title="Go to homepage"
            onClick={() => setPage("Home")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setPage("Home");
            }}
          />
          <h1>Cyber Crime Dashboard</h1>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              className={page === item.label ? "active" : ""}
              onClick={() => setPage(item.label)}
              key={item.label}
              title={sidebarCollapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <span className={`nav-icon nav-icon-${item.tone}`} aria-hidden="true">
                <NavIcon type={item.icon} />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        {datasetSummary && (
          <div className="dataset-badge">
            <span className="muted">Loaded dataset</span>
            <strong>{datasetSummary}</strong>
          </div>
        )}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>{pageTitle}</h2>
            {message && <p className={message.includes("failed") || message.includes("Missing") ? "muted error-text" : "muted"}>{message}</p>}
          </div>
          <label className="upload upload-topbar">
            <div className="upload-topbar-label">
              <div className="upload-topbar-main">{uploading ? "Cleaning..." : "Upload dataset"}</div>
              <div className="upload-topbar-sub">Upload raw dataset</div>
            </div>
            <input type="file" accept=".csv,.xlsx" onChange={uploadFile} />
          </label>
        </header>

        <main className="main">
          {page === "Home" && (
            <Home
              onUpload={uploadFile}
              uploading={uploading}
              message={message}
              hasData={Boolean(data)}
              fileName={fileName}
            />
          )}
          {page === "Overview" && <Overview data={data} />}
          {page === "Analysis" && <Analysis data={data} />}
          {page === "Machine Learning" && <MachineLearning data={data} />}
          {page === "Future Crime Prediction" && <FutureCrimePrediction data={data} />}
          {page === "About Project" && <AboutProject />}
        </main>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
