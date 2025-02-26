const config = {
  videoElement: "ytd-playlist-video-renderer",
  videoElementsContainer: "ytd-playlist-video-list-renderer #contents",
  timestampContainer: "ytd-thumbnail-overlay-time-status-renderer",
  metadataContainer: {
    main: ".immersive-header-content .metadata-action-bar",
    fallback: "ytd-playlist-sidebar-renderer #items"
  },
  statsContainer: {
    main: ".metadata-stats yt-formatted-string",
    fallback: "#stats yt-formatted-string"
  },
  // Design anchor = Element that helps distinguish between old & new layout
  designAnchor: {
    old: "ytd-playlist-sidebar-renderer",
    new: "ytd-playlist-header-renderer"
  }
};

const pollPlaylistReady = () => {
  displayLoader();

  const maxPollCount = 60;
  let pollCount = 0;

  let playlistPoll = setInterval(() => {
    if (pollCount >= maxPollCount) clearInterval(playlistPoll);

    if (
      document.querySelector(config.timestampContainer) &&
      countUnavailableTimestamps() === countUnavailableVideos()
    ) {
      clearInterval(playlistPoll);
      processPlaylist();
    }

    pollCount++;
  }, 1000);
};

const displayLoader = () => {
  const playlistSummary = document.querySelector(
    isNewDesign()
      ? "#ytpdc-playlist-summary-new"
      : "#ytpdc-playlist-summary-old"
  );

  if (playlistSummary) {
    const loading = document.createElement("div");
    loading.style.minHeight = "128px";
    loading.style.width = "100%";
    loading.style.display = "flex";
    loading.style.justifyContent = "center";
    loading.style.alignItems = "center";
    loading.textContent = "Calculating...";

    playlistSummary.innerHTML = "";
    playlistSummary.appendChild(loading);
  }
};

const countUnavailableTimestamps = () => {
  const timestamps = getTimestamps(getVideos());
  return timestamps.filter((timestamp) => timestamp === null).length;
};

const countUnavailableVideos = () => {
  const unavailableVideoTitles = [
    "[Private video]",
    "[Deleted video]",
    "[Unavailable]",
    "[Video unavailable]",
    "[Restricted video]",
    "[Age restricted]"
  ];

  const videoTitles = document.querySelectorAll("a#video-title");

  let unavailableVideosCount = 0;

  videoTitles.forEach((videoTitle) => {
    if (unavailableVideoTitles.includes(videoTitle.title)) {
      unavailableVideosCount++;
    }
  });

  return unavailableVideosCount;
};

const processPlaylist = () => {
  configurePage();
  setupPlaylistObserver();
  setupEventListeners();
  const videos = getVideos();
  const timestamps = getTimestamps(videos);
  const totalDurationInSeconds = timestamps.reduce((a, b) => a + b);
  const playlistDuration = formatTimestamp(totalDurationInSeconds);
  const playlistSummary = createPlaylistSummary({
    timestamps,
    playlistDuration
  });
  addSummaryToPage(playlistSummary);
};

const configurePage = () => {
  if (window.ytpdc) return;
  window.ytpdc = { playlistObserver: false, interPlaylistNavigation: false };
};

const setupPlaylistObserver = () => {
  if (window.ytpdc.playlistObserver) return;
  window.ytpdc.playlistObserver = true;

  const playlistObserver = new MutationObserver((_) => {
    pollPlaylistReady();
  });

  const targetNode = document.querySelector(config.videoElementsContainer);
  if (targetNode) {
    playlistObserver.observe(targetNode, { childList: true });
  }
};

const setupEventListeners = () => {
  if (!window.ytpdc.interPlaylistNavigation) {
    window.ytpdc.interPlaylistNavigation = true;
    document.addEventListener(
      "yt-navigate-finish",
      () => pollPlaylistReady(),
      false
    );
  }
};

const getVideos = (start = 0, end = 1e9) => {
  const videoElementsContainer = document.querySelector(
    config.videoElementsContainer
  );
  const videos = videoElementsContainer.getElementsByTagName(
    config.videoElement
  );
  return Array.from(videos).slice(start, end);
};

const getTimestamps = (videos) => {
  return videos.map((video) => {
    if (!video) return null;

    const timestampContainer = video.querySelector(config.timestampContainer);
    if (!timestampContainer) return null;

    const formattedTimestamp = timestampContainer.innerText;
    if (!formattedTimestamp) return null;

    const timestamp = unformatTimestamp(formattedTimestamp);
    return timestamp;
  });
};

const formatTimestamp = (timestamp) => {
  let totalSeconds = timestamp;
  const hours = `${Math.floor(totalSeconds / 3600)}`.padStart(2, "0");
  totalSeconds %= 3600;
  const minutes = `${Math.floor(totalSeconds / 60)}`.padStart(2, "0");
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const createPlaylistSummary = ({ timestamps, playlistDuration }) => {
  const summaryContainer = document.createElement("div");

  // Styles for new design
  summaryContainer.style.display = "flex";
  summaryContainer.style.flexDirection = "column";
  summaryContainer.style.justifyContent = "center";
  summaryContainer.style.alignItems = "start";
  summaryContainer.style.minHeight = "128px";
  summaryContainer.style.margin = "16px 0px";
  summaryContainer.style.padding = "16px";
  summaryContainer.style.borderRadius = "16px";
  summaryContainer.style.background = "rgba(255,255,255,0.2)";
  summaryContainer.style.fontSize = "1.5rem";

  // Fallback styles for old design
  if (!isNewDesign()) {
    if (isDarkMode()) {
      summaryContainer.style.color = "white";
    } else {
      summaryContainer.style.background = "rgba(0,0,0,0.8)";
      summaryContainer.style.color = "white";
    }
  }

  // Total Duration
  const totalDuration = createSummaryItem(
    "Total duration:",
    `${playlistDuration}`,
    "#86efac"
  );
  summaryContainer.appendChild(totalDuration);

  // Videos counted
  const videosCounted = createSummaryItem(
    "Videos counted:",
    `${timestamps.length}`,
    "#fdba74"
  );
  summaryContainer.appendChild(videosCounted);

  // Videos not counted
  const totalVideosInPlaylist = countTotalVideosInPlaylist();
  const videosNotCounted = createSummaryItem(
    "Videos not counted:",
    `${
      totalVideosInPlaylist ? totalVideosInPlaylist - timestamps.length : "N/A"
    }`,
    "#fca5a5"
  );
  summaryContainer.appendChild(videosNotCounted);

  //Range Summary container - Toggle Button
  const rangeSummaryToggleButton = createRangeSummaryToggleButton();
  summaryContainer.appendChild(rangeSummaryToggleButton);

  // Tooltip
  if (timestamps.length >= 100) {
    const tooltip = document.createElement("div");
    tooltip.style.marginTop = "16px";
    tooltip.style.display = "flex";
    tooltip.style.flexDirection = "row";
    tooltip.style.alignItems = "center";

    const icon = document.createElement("div");
    icon.style.color = "#000";
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><path fill="white" fill-rule="evenodd" d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11s11-4.925 11-11S18.075 1 12 1Zm-.5 5a1 1 0 1 0 0 2h.5a1 1 0 1 0 0-2h-.5ZM10 10a1 1 0 1 0 0 2h1v3h-1a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-1v-4a1 1 0 0 0-1-1h-2Z" clip-rule="evenodd"/></svg>`;
    tooltip.appendChild(icon);

    const tooltipText = document.createElement("p");
    tooltipText.style.paddingLeft = "8px";
    tooltipText.textContent = "Scroll down to count more videos";
    tooltip.appendChild(tooltipText);

    summaryContainer.appendChild(tooltip);
  }

  return summaryContainer;
};

const unformatTimestamp = (formattedTimestamp) => {
  let timeComponents = formattedTimestamp
    .split(":")
    .map((timeComponent) => parseInt(timeComponent, 10));

  let seconds = 0;
  let minutes = 1;

  while (timeComponents.length > 0) {
    let timeComponent = timeComponents.pop();
    if (isNaN(timeComponent)) continue;

    seconds += minutes * timeComponent;
    minutes *= 60;
  }

  return seconds;
};

const createSummaryItem = (label, value, valueColor = "#facc15") => {
  const container = document.createElement("div");
  container.style.margin = "8px 0px";
  container.style.display = "flex";
  container.style.flexDirection = "row";
  container.style.justifyContent = "between";

  const labelContainer = document.createElement("p");
  labelContainer.textContent = label;

  const valueContainer = document.createElement("p");
  valueContainer.style.color = valueColor;
  valueContainer.style.fontWeight = 700;
  valueContainer.style.paddingLeft = "8px";
  valueContainer.textContent = value;

  container.appendChild(labelContainer);
  container.appendChild(valueContainer);

  return container;
};

const createRangeSummaryToggleButton = () => {
  const calculateRangeButtonText = "CALCULATE CUSTOM DURATION";
  const switchElement = createButton(calculateRangeButtonText);

  const rangeSummaryItem = createRangeSummaryItem();

  switchElement.addEventListener("click", (e) => {
    const summaryContainer = document.getElementById(
      "ytpdc-playlist-summary-new"
    );
    if (summaryContainer.lastChild.innerText === calculateRangeButtonText) {
      summaryContainer.appendChild(rangeSummaryItem);
    } else {
      while (summaryContainer.lastChild.innerText != calculateRangeButtonText) {
        summaryContainer.removeChild(summaryContainer.lastChild);
      }
    }
  });
  return switchElement;
};

const createRangeSummaryItem = () => {
  const rangeSummaryContainer = document.createElement("div");

  rangeSummaryContainer.id = "rangeSummaryContainer";

  rangeSummaryContainer.style.display = "flex";
  rangeSummaryContainer.style.flexDirection = "column";
  rangeSummaryContainer.style.justifyContent = "center";
  rangeSummaryContainer.style.alignItems = "start";
  rangeSummaryContainer.style.marginTop = "18px";
  rangeSummaryContainer.style.padding = "16px";
  rangeSummaryContainer.style.borderRadius = "16px";
  rangeSummaryContainer.style.background = "rgba(255,255,255,0.1)";

  // Total Duration
  const rangeSummaryInput = createRangeSummaryInput();
  rangeSummaryContainer.appendChild(rangeSummaryInput);

  const calculateRangeSummaryButton = createButton("Calculate");
  calculateRangeSummaryButton.addEventListener("click", showRangeSummary);
  calculateRangeSummaryButton.style.padding = "10px 75px";
  rangeSummaryContainer.appendChild(calculateRangeSummaryButton);

  return rangeSummaryContainer;
};

const getRangeSummary = (startCustomRangeIndex, endCustomRangeIndex) => {
  const videos = getVideos(startCustomRangeIndex - 1, endCustomRangeIndex);
  const timestamps = getTimestamps(videos);
  const customDurationInSeconds = timestamps.reduce((a, b) => a + b);
  const customPlaylistDuration = formatTimestamp(customDurationInSeconds);
  return customPlaylistDuration;
};

const isProperRangeInput = (startCustomRangeIndex, endCustomRangeIndex) => {
  const isProperInteger = (val) => {
    const intValue = parseInt(val, 10);
    return (
      !isNaN(intValue) &&
      val.trim() === intValue.toString() &&
      intValue > 0 &&
      intValue <= 1e9
    );
  };

  return (
    isProperInteger(startCustomRangeIndex) &&
    isProperInteger(endCustomRangeIndex) &&
    startCustomRangeIndex <= endCustomRangeIndex
  );
};

const showRangeSummary = () => {
  const startCustomRangeIndex = document.getElementById(
    "customRangeInputStart"
  ).value;
  const endCustomRangeIndex = document.getElementById(
    "customRangeInputEnd"
  ).value;

  const customDurationContainer = isProperRangeInput(
    startCustomRangeIndex,
    endCustomRangeIndex
  )
    ? getRangeSummary(startCustomRangeIndex, endCustomRangeIndex)
    : createSummaryItem("Error:", `Please enter proper numbers!`, "");

  customDurationContainer.id = "customDurationContainer";

  const summaryContainer = document.getElementById(
    "ytpdc-playlist-summary-new"
  );

  if (summaryContainer.lastChild.id === customDurationContainer.id) {
    summaryContainer.removeChild(summaryContainer.lastChild);
  }
  summaryContainer.appendChild(customDurationContainer);
};

const createRangeSummaryInput = () => {
  const container = document.createElement("div");
  container.style.margin = "8px 0px";
  container.style.display = "flex";
  container.style.flexDirection = "row";
  container.style.justifyContent = "between";

  const startLabelContainer = document.createElement("p");
  startLabelContainer.style.paddingTop = "2px";
  startLabelContainer.textContent = "Start: ";

  const startInput = createInput("customRangeInputStart");

  const endLabelContainer = document.createElement("p");
  endLabelContainer.style.paddingLeft = "12px";
  endLabelContainer.style.paddingTop = "2px";
  endLabelContainer.textContent = "End: ";

  const endInput = createInput("customRangeInputEnd");

  container.appendChild(startLabelContainer);
  container.appendChild(startInput);

  container.appendChild(endLabelContainer);
  container.appendChild(endInput);

  return container;
};

const createInput = (id) => {
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.style.marginLeft = "8px";
  input.style.padding = "8px";
  input.style.border = "1px solid #ccc";
  input.style.borderRadius = "4px";
  input.style.backgroundColor = "white";
  input.style.width = "40px";
  input.style.height = "7px";
  input.style.textAlign = "center";
  return input;
};

const createButton = (text) => {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.padding = "10px 15px";
  button.style.marginTop = "10px";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.backgroundColor = "#4CAF50"; // Green background color
  button.style.color = "white";
  button.style.fontWeight = "bold";
  button.style.cursor = "pointer";
  button.style.transition = "background-color 0.3s";

  // Add hover effect
  button.addEventListener("mouseover", () => {
    button.style.backgroundColor = "#45a049"; // Darker green on hover
  });

  // Reset background color on mouseout
  button.addEventListener("mouseout", () => {
    button.style.backgroundColor = "#4CAF50";
  });
  return button;
};

const addSummaryToPage = (summary) => {
  const newDesign = isNewDesign();

  let metadataSection = document.querySelector(
    newDesign
      ? config.metadataContainer.main
      : config.metadataContainer.fallback
  );
  if (!metadataSection) return null;

  const previousSummary = document.querySelector(
    newDesign ? "#ytpdc-playlist-summary-new" : "#ytpdc-playlist-summary-old"
  );

  if (previousSummary) {
    previousSummary.parentNode.removeChild(previousSummary);
  }

  summary.id = newDesign
    ? "ytpdc-playlist-summary-new"
    : "ytpdc-playlist-summary-old";

  metadataSection.parentNode.insertBefore(summary, metadataSection.nextSibling);
};

const countTotalVideosInPlaylist = () => {
  const totalVideosStat = document.querySelector(
    isNewDesign() ? config.statsContainer.main : config.statsContainer.fallback
  );

  if (!totalVideosStat) return null;

  const totalVideoCount = parseInt(
    totalVideosStat.innerText.replace(/\D/g, "")
  );

  return totalVideoCount;
};

const isDarkMode = () => {
  return document.documentElement.getAttribute("dark") !== null;
};

const isNewDesign = () => {
  const newDesignAnchor = document.querySelector(config.designAnchor.new);
  const oldDesignAnchor = document.querySelector(config.designAnchor.old);

  const isNewDesign =
    newDesignAnchor && oldDesignAnchor.getAttribute("hidden") !== null;

  return isNewDesign;
};

export { pollPlaylistReady };
