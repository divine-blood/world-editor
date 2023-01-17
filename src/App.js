import React from "react";
import {
  Tooltip,
  Box,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextareaAutosize,
  Button,
  IconButton,
  Paper,
  Grow,
  ClickAwayListener,
  MenuList,
  Popper,
  CircularProgress,
} from "@material-ui/core";

import CancelIcon from "@material-ui/icons/Cancel";
import WrapTextIcon from "@material-ui/icons/WrapText";
import SaveAltIcon from "@material-ui/icons/SaveAlt";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import AddLocationIcon from "@material-ui/icons/AddLocation";
import ZoomOutMapIcon from "@material-ui/icons/ZoomOutMap";
import NoteAdd from "@material-ui/icons/NoteAdd";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import PostAddIcon from "@material-ui/icons/PostAdd";
import DeleteForeverIcon from "@material-ui/icons/DeleteForever";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import LockIcon from "@material-ui/icons/Lock";
import LineStyleIcon from "@material-ui/icons/LineStyle";

import { withStyles } from "@material-ui/core/styles";
import DraggableCore from "react-draggable";
import { INITIAL_VALUE, ReactSVGPanZoom } from "react-svg-pan-zoom";
import { GoogleLogin } from "react-google-login";
import { gapi } from "gapi-script";

const roomGrid = [100, 60];
const imageDimensions = [roomGrid[0] * 70, roomGrid[1] * 100];
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const awsEndpoint = process.env.REACT_APP_AWS_ENDPOINT;

function objForeach(obj, f) {
  Object.entries(obj).forEach((entry) => {
    const [key, value] = entry;
    f(key, value);
  });
}

function objMap(obj, f) {
  return Object.entries(obj).map((entry) => {
    const [key, value] = entry;
    return f(key, value);
  });
}

function objFilter(obj, f) {
  var copy = {};
  Object.entries(obj).forEach((entry) => {
    const [key, value] = entry;
    if (f(key, value)) {
      copy[key] = value;
    }
  });
  return copy;
}

function shuffled(lst) {
  return lst
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function formatTextArea(name) {
  const text = wordWrap(document.getElementById(name).value);
  document.getElementById(name).value = text;
  return text;
}

function wordWrap(str) {
  str = str.replaceAll(/\r/g, "");
  str = str.replaceAll(/\n\n+/g, "\n\n");
  return (
    str
      .split("\n\n")
      .map((paragraph) => {
        paragraph = paragraph
          .replaceAll(/^([a-z])/g, (str, g) => g.toUpperCase())
          .replaceAll(/\s+/g, " ")
          .replaceAll(/([.!?]) ([a-z])/g, (str, g1, g2) => g1 + " " + g2.toUpperCase());
        let r = "";
        let line = "";
        paragraph.split(/\s+/g).forEach((w) => {
          const newlen = line.length + w.length + 1;
          if (newlen > 76) {
            if (newlen - 76 < w.length) {
              r += line + w + "\n";
              line = "";
            } else {
              r += line + "\n";
              line = w + " ";
            }
          } else {
            line += w + " ";
          }
        });
        if (line) {
          r += line + "\n";
        }
        return r;
      })
      .join("\n")
      .trim() + "\n"
  );
}

function centerRooms(rooms) {
  const yBounds = [
    Math.min(...rooms.map((room) => room.editor_grid_y)),
    Math.max(...rooms.map((room) => room.editor_grid_y)),
  ];
  const xBounds = [
    Math.min(...rooms.map((room) => room.editor_grid_x)),
    Math.max(...rooms.map((room) => room.editor_grid_x)),
  ];
  rooms.forEach((room) => {
    room.editor_grid_x -= xBounds[1] - Math.floor((xBounds[1] - xBounds[0]) / 2);
    room.editor_grid_y -= yBounds[1] - Math.floor((yBounds[1] - yBounds[0]) / 2);
  });
}

function defragRooms(data) {
  var moves = {};
  data.rooms
    .sort((a, b) => a.vnum < b.vnum)
    .forEach((room) => {
      for (var i = data.lower_vnum; i < room.vnum; i++) {
        const vnum = i;
        if (data.rooms.find((r) => r.vnum === vnum) === undefined && !Object.values(moves).includes(i)) {
          moves[room.vnum] = i;
          break;
        }
      }
    });
  data.rooms.forEach((room) => {
    if (room.vnum in moves) {
      room.vnum = moves[room.vnum];
    }
    objForeach(room.exits, (dir, exit) => {
      if (exit.to in moves) {
        exit.to = moves[exit.to];
      }
    });
  });
}

function initialPos(rooms) {
  var roomMap = rooms.reduce((acc, cur) => ({ ...acc, [cur.vnum]: cur }), {});
  var taken = rooms
    .filter((room) => room.editor_grid_x && room.editor_grid_y)
    .reduce(
      (acc, cur) => ({
        ...acc,
        [cur.editor_grid_x + " " + cur.editor_grid_y]: true,
      }),
      {}
    );
  var toPlace = rooms.filter((room) => room.editor_grid_x === undefined && room.editor_grid_y === undefined);
  const tryPlace = (vnum, newX, newY) => {
    if (!(vnum in roomMap) || taken[newX + " " + newY]) {
      return;
    }
    const room = roomMap[vnum];
    if (room.editor_grid_x || room.editor_grid_y) {
      taken[room.editor_grid_x + " " + room.editor_grid_y] = false;
    }
    room.editor_grid_x = newX;
    room.editor_grid_y = newY;
    taken[room.editor_grid_x + " " + room.editor_grid_y] = true;
  };
  toPlace.forEach((room) => {
    if (room.editor_grid_x === undefined || room.editor_grid_y === undefined) {
      while (true) {
        room.editor_grid_x = Math.floor(Math.random() * 16) - 8;
        room.editor_grid_y = Math.floor(Math.random() * 16) - 8;
        if (taken[room.editor_grid_x + " " + room.editor_grid_y]) {
          continue;
        }
        taken[room.editor_grid_x + " " + room.editor_grid_y] = true;
        break;
      }
    }
  });
  for (var i = 0; i <= 25; i++) {
    shuffled(toPlace).forEach((room) => {
      objForeach(room.exits, (dir, exit) => {
        switch (dir.toLowerCase()) {
          case "north":
            tryPlace(exit.to, room.editor_grid_x, room.editor_grid_y - 2);
            break;
          case "south":
            tryPlace(exit.to, room.editor_grid_x, room.editor_grid_y + 2);
            break;
          case "west":
            tryPlace(exit.to, room.editor_grid_x - 2, room.editor_grid_y);
            break;
          case "east":
            tryPlace(exit.to, room.editor_grid_x + 2, room.editor_grid_y);
            break;
          case "southwest":
            tryPlace(exit.to, room.editor_grid_x - 2, room.editor_grid_y - 2);
            break;
          case "northeast":
            tryPlace(exit.to, room.editor_grid_x + 2, room.editor_grid_y + 2);
            break;
          case "northwest":
            tryPlace(exit.to, room.editor_grid_x - 2, room.editor_grid_y + 2);
            break;
          case "southeast":
            tryPlace(exit.to, room.editor_grid_x + 2, room.editor_grid_y - 2);
            break;
          case "up":
            tryPlace(exit.to, room.editor_grid_x - 1, room.editor_grid_y - 1);
            tryPlace(exit.to, room.editor_grid_x + 1, room.editor_grid_y - 1);
            break;
          case "down":
            tryPlace(exit.to, room.editor_grid_x + 1, room.editor_grid_y + 1);
            tryPlace(exit.to, room.editor_grid_x - 1, room.editor_grid_y + 1);
            break;
          default:
            break;
        }
      });
    });
  }
  centerRooms(rooms);
}

function download(content, fileName, contentType) {
  var a = document.createElement("a");
  var file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

const dirInfo = {
  north: { rev: "south", abbr: "n", offsets: { x: 50, y: 10 } },
  south: { rev: "north", abbr: "s", offsets: { x: 50, y: 50 } },
  east: { rev: "west", abbr: "e", offsets: { x: 90, y: 30 } },
  west: { rev: "east", abbr: "w", offsets: { x: 10, y: 30 } },
  northwest: { rev: "southeast", abbr: "nw", offsets: { x: 10, y: 10 } },
  northeast: { rev: "southwest", abbr: "ne", offsets: { x: 90, y: 10 } },
  southeast: { rev: "northwest", abbr: "se", offsets: { x: 90, y: 50 } },
  southwest: { rev: "northeast", abbr: "sw", offsets: { x: 10, y: 50 } },
  up: { rev: "down", abbr: "u", offsets: { x: 30, y: 7 } },
  down: { rev: "up", abbr: "d", offsets: { x: 30, y: 52 } },
};

const sectors = {
  inside: { color: "#CCCCCC" },
  city: { color: "#666666" },
  field: { color: "#CCFF66" },
  forest: { color: "#006600" },
  hills: { color: "#999933" },
  mountain: { color: "#663300" },
  swim: { color: "#66CCFF" },
  noswim: { color: "#66CCFF" },
  unused: { color: "white" },
  air: { color: "#FFFFCC" },
  desert: { color: "#CC9966" },
  underwater: { color: "#000099" },
  tundra: { color: "#6699CC" },
  cave: { color: "black" },
  exotic: { color: "#CC66CC" },
};

const exitFlags = [
  "door",
  "closed",
  "locked",
  "pickproof",
  "nopass",
  "easy",
  "hard",
  "infuriating",
  "noclose",
  "nolock",
  "nobash",
  "hidden",
];

const roomFlags = [
  "bank",
  "dark",
  "no_mob",
  "indoors",
  "no_magic",
  "private",
  "safe",
  "solitary",
  "pet_shop",
  "no_recall",
  "imp_only",
  "gods_only",
  "heroes_only",
  "newbies_only",
  "arena",
  "nowhere",
  "holy",
  "available",
  "spectator",
  "home_allow",
  "no_home",
  "no_quest",
];

const ExitLine = ({ from, to }) => {
  var fromDir = null;
  var toDir = null;
  objForeach(from.exits, (door, exit) => {
    if (exit.to === to.vnum) {
      fromDir = door;
    }
  });
  objForeach(to.exits, (door, exit) => {
    if (exit.to === from.vnum) {
      toDir = door;
    }
  });
  if (!toDir) {
    toDir = dirInfo[fromDir].rev;
  }
  return (
    <line
      x1={imageDimensions[0] / 2 + from.editor_grid_x * roomGrid[0] + dirInfo[fromDir].offsets.x}
      y1={imageDimensions[1] / 2 + from.editor_grid_y * roomGrid[1] + dirInfo[fromDir].offsets.y}
      x2={imageDimensions[0] / 2 + to.editor_grid_x * roomGrid[0] + dirInfo[toDir].offsets.x}
      y2={imageDimensions[1] / 2 + to.editor_grid_y * roomGrid[1] + dirInfo[toDir].offsets.y}
      stroke="#0099FF"
      strokeWidth={2}
      style={{ pointerEvents: "none" }}
    />
  );
};

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const StyledTableCell = withStyles((theme) => ({
  head: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  body: {
    fontSize: 14,
  },
}))(TableCell);

const StyledTableRow = withStyles((theme) => ({
  root: {
    "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover,
    },
  },
}))(TableRow);

function AreaEditor({ data, setData, setEditData, editData, style }) {
  const viewer = React.useRef(null);
  const [value, setValue] = React.useState(INITIAL_VALUE);
  const [dimensions, setDimensions] = React.useState([0, 0]);
  const [dragging, setDragging] = React.useState(false);
  const [addRoomMode, setAddRoomMode] = React.useState(false);
  const [lockAddRoomMode, setLockAddRoomMode] = React.useState(false);

  const setUpImage = React.useCallback((node) => {
    if (node) {
      new ResizeObserver((entries) => {
        const dimensions = node.getBoundingClientRect();
        setDimensions([dimensions.width, dimensions.height]);
      }).observe(node);
    }
  }, []);

  const setUpView = React.useCallback((view) => {
    if (view) {
      viewer.current = view;
      view.setPointOnViewerCenter(imageDimensions[0] / 2, imageDimensions[1] / 2, 2);
    }
  }, []);

  const roomMap = React.useMemo(
    () => data?.rooms && Object.fromEntries(data.rooms.map((room) => [room.vnum, room])),
    [data]
  );

  const updatePosition = (room, eventData) => {
    room.editor_grid_x = (eventData.x - imageDimensions[0] / 2) / roomGrid[0];
    room.editor_grid_y = (eventData.y - imageDimensions[1] / 2) / roomGrid[1];
    setData({ ...data });
  };

  const exitColor = (room, dir) => {
    var r = "white";
    objForeach(room.exits, (door, exit) => {
      if (door === dir) {
        if (exit.flags?.includes("locked")) {
          r = "red";
        } else if (exit.flags?.includes("closed")) {
          r = "orange";
        } else if (exit.flags?.includes("door")) {
          r = "yellow";
        } else if (exit?.to) {
          r = "#AAA";
        }
      }
    });
    return r;
  };

  const clickRoom = (room) => {
    if (dragging) {
      return;
    }
    if (editData && editData[0] === "exit" && !editData[1].to) {
      editData[1] = { ...editData[1], to: room.vnum };
      setEditData([...editData]);
    } else {
      setEditData(["room", room]);
    }
  };

  const firefox = navigator.userAgent.indexOf("Firefox") > -1;

  const rooms =
    data?.rooms &&
    data.rooms.map((room) => (
      <DraggableCore
        position={{
          x: imageDimensions[0] / 2 + room.editor_grid_x * roomGrid[0],
          y: imageDimensions[1] / 2 + room.editor_grid_y * roomGrid[1],
        }}
        grid={roomGrid}
        onDrag={(e, data) => {
          setDragging(true);
          return updatePosition(room, data);
        }}
        onStop={(e, data) => {
          return updatePosition(room, data);
        }}
        onMouseDown={(e) => {
          setDragging(false);
          e.stopPropagation();
        }}
        key={"room-" + room.vnum}
      >
        <svg
          {...(firefox
            ? {}
            : {
                x: imageDimensions[0] / 2 + room.editor_grid_x * roomGrid[0],
                y: imageDimensions[1] / 2 + room.editor_grid_y * roomGrid[1],
              })}
          width={roomGrid[0]}
          height={roomGrid[1]}
          id={"room-" + room.vnum}
          onClick={() => clickRoom(room)}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x={10} y={10} width={80} height={10} stroke="black" fill={sectors[room.sector].color} strokeWidth="1" />
          <rect
            x={10}
            y={10}
            width={80}
            height={40}
            stroke={editData && editData[0] === "room" && editData[1].vnum === room.vnum ? "red" : "black"}
            strokeWidth={editData && editData[0] === "room" && editData[1].vnum === room.vnum ? 3 : 1}
            fill="transparent"
          />
          {Object.keys(dirInfo).map((dir) => (
            <>
              <rect
                className={"exitCircle"}
                key={"exit-" + room.vnum + "-" + dir}
                x={dirInfo[dir].offsets.x - 5}
                y={dirInfo[dir].offsets.y - 5}
                width={10}
                height={10}
                rx={2}
                fill={exitColor(room, dir)}
                strokeWidth={0.5}
                onClick={(e) => {
                  e.stopPropagation();
                  var exit = null;
                  if (!(dir in room.exits) || !room.exits[dir].to) {
                    exit = { to: null };
                    room.exits[dir] = exit;
                  }
                  setEditData(["exit", room.exits[dir], room, dir]);
                }}
              />
              <text
                x={dirInfo[dir].offsets.x}
                y={dirInfo[dir].offsets.y + 2}
                textAnchor="middle"
                style={{ fontSize: 7, pointerEvents: "none" }}
              >
                {dirInfo[dir].abbr}
              </text>
            </>
          ))}
          <text
            x="20"
            y="28"
            style={{
              fontSize: 7,
              pointerEvents: "none",
              width: 50,
              overflow: "hidden",
            }}
          >
            {room.name}
          </text>
        </svg>
      </DraggableCore>
    ));

  const gridLines = React.useMemo(() => {
    const center = [imageDimensions[0] / 2, imageDimensions[1] / 2];
    const horizontal = Array.from(Array(imageDimensions[0] / roomGrid[0])).map((x, i) => (
      <line
        x1={i * roomGrid[0]}
        y1={0}
        x2={i * roomGrid[0]}
        y2={imageDimensions[1]}
        stroke="#DDD"
        key={"horiz-grid-" + i}
        style={{ pointerEvents: "none" }}
      />
    ));
    const vertical = Array.from(Array(imageDimensions[1] / roomGrid[1])).map((x, i) => (
      <line
        y1={i * roomGrid[1]}
        x1={0}
        y2={i * roomGrid[1]}
        x2={imageDimensions[0]}
        stroke="#DDD"
        key={"vert-grid-" + i}
        style={{ pointerEvents: "none" }}
      />
    ));
    return horizontal
      .concat(vertical)
      .concat([
        <line
          y1={center[1]}
          x1={center[0] - 15}
          y2={center[1]}
          x2={center[0] + 15}
          stroke="#000"
          strokeWidth={2}
          key={"vert-grid-horiz"}
          style={{ pointerEvents: "none" }}
        />,
        <line
          y1={center[1] - 15}
          x1={center[0]}
          y2={center[1] + 15}
          x2={center[0]}
          stroke="#000"
          strokeWidth={2}
          key={"vert-grid-vert"}
          style={{ pointerEvents: "none" }}
        />,
      ]);
  }, []);

  const lines = React.useMemo(() => {
    return data?.rooms
      ?.map((room) =>
        objMap(room.exits, (door, exit) => {
          const from = roomMap[room.vnum];
          const to = roomMap[exit.to];
          if (from && to) {
            return <ExitLine from={from} to={to} stroke="red" key={"exit-" + room.vnum + "-" + door} />;
          } else {
            return <></>;
          }
        })
      )
      .flat(1);
  }, [data, roomMap]);

  const addRoom = (e) => {
    const bounds = e.target.getBoundingClientRect();
    const grid = [
      bounds.width / (imageDimensions[0] / roomGrid[0]),
      bounds.height / (imageDimensions[1] / roomGrid[1]),
    ];
    setAddRoomMode(false);
    for (var i = data.lower_vnum; i < data.upper_vnum; i++) {
      const vnum = i;
      if (data.rooms.find((room) => room.vnum === vnum) === undefined) {
        data.rooms.push({
          vnum: vnum,
          editor_grid_x: Math.floor((e.clientX - bounds.left) / grid[0]) - 35,
          editor_grid_y: Math.floor((e.clientY - bounds.top) / grid[1]) - 50,
          name: "New Room",
          exits: {},
          room_flags: [],
          sector: "inside",
        });
        setData({ ...data });
        return;
      }
    }
    alert("No vnums available.");
  };

  const MapToolBar = (props) => (
    <div
      {...props}
      style={{
        backgroundColor: "black",
        position: "absolute",
        left: 10,
        top: 25,
      }}
    >
      <Tooltip title="Add Room">
        <IconButton color={addRoomMode ? "secondary" : ""} onClick={() => setAddRoomMode(!addRoomMode)}>
          <AddLocationIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Lock Add Room">
        <IconButton color={lockAddRoomMode ? "secondary" : ""} onClick={() => setLockAddRoomMode(!lockAddRoomMode)}>
          <LockIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Defrag Rooms">
        <IconButton
          onClick={() => {
            defragRooms(data);
            setData({ ...data });
          }}
        >
          <LineStyleIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Re-Center Area">
        <IconButton
          onClick={() => {
            centerRooms(data?.rooms || []);
            setData({ ...data });
          }}
        >
          <ZoomOutMapIcon />
        </IconButton>
      </Tooltip>
    </div>
  );

  return (
    <div
      ref={setUpImage}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        cursor: addRoomMode || lockAddRoomMode ? "crosshair" : "auto",
      }}
    >
      <ReactSVGPanZoom
        width={dimensions[0]}
        height={dimensions[1]}
        ref={setUpView}
        tool={"auto"}
        value={value}
        onChangeValue={setValue}
        resizeMode="contain"
        preventPanOutside={true}
        detectAutoPan={false}
        scaleFactorOnWheel={1.4}
        customToolbar={MapToolBar}
      >
        <svg width={imageDimensions[0]} height={imageDimensions[1]} xmlns="http://www.w3.org/2000/svg">
          <rect
            x={0}
            y={0}
            width={imageDimensions[0]}
            height={imageDimensions[1]}
            fill="transparent"
            onClick={(e) => (addRoomMode || lockAddRoomMode) && addRoom(e)}
          />
          {gridLines}
          {rooms}
          {lines}
        </svg>
      </ReactSVGPanZoom>
    </div>
  );
}

function ObjectForm({ data, setData, setEditData, editData }) {
  const objEditData = React.useMemo(() => editData[1], [editData]);

  const updateObject = () => {
    Object.assign(editData[1], objEditData);
    setData({ ...data });
    setEditData(null);
  };

  const stripObject = (resets, vnum) => {
    resets.forEach((reset) => {
      if (reset.objects) {
        reset.objects = stripObject(reset.objects, vnum);
      }
    });
    return resets.filter((reset) => reset.type !== "object" || reset.vnum !== vnum);
  };

  const deleteObject = (vnum) => {
    if (!window.confirm("Delete Object #" + vnum + "?")) {
      return;
    }
    data.objects = data.objects.filter((obj) => obj.vnum !== vnum);
    data.rooms.forEach((room) => {
      if (room.resets) {
        room.resets = stripObject(room.resets, vnum);
      }
    });
    setData({ ...data });
    setEditData(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        width: 600,
        top: 58,
        bottom: 0,
        right: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        backgroundColor: "black",
        padding: 20,
      }}
      key={Date.now()}
    >
      <form>
        <IconButton variant="contained" onClick={() => setEditData(null)} style={{ float: "right" }}>
          <CancelIcon color="secondary"></CancelIcon>
        </IconButton>
        Object #{objEditData.vnum}
        <TextField
          id="obj-name"
          label="Name"
          variant="outlined"
          defaultValue={objEditData?.name}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            objEditData.name = e.target.value;
          }}
        />
        <TextField
          id="obj-short_description"
          label="Short Description"
          variant="outlined"
          defaultValue={objEditData?.short_description}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            objEditData.short_description = e.target.value;
          }}
        />
        <TextField
          id="obj-description"
          label="Description"
          variant="outlined"
          defaultValue={objEditData?.description}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            objEditData.description = e.target.value;
          }}
        />
        <div style={{ textAlign: "left" }}>
          <Button
            variant="contained"
            color="secondary"
            style={{ marginRight: 5 }}
            onClick={() => deleteObject(objEditData.vnum)}
          >
            Delete Object
          </Button>
          <div style={{ float: "right" }}>
            <Button variant="contained" color="primary" style={{ marginRight: 15 }} onClick={updateObject}>
              Update
            </Button>
            <Button variant="contained" onClick={() => setEditData(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MobForm({ data, setData, setEditData, editData }) {
  const mobEditData = React.useMemo(() => ({ ...editData[1] }), [editData]);

  const updateMob = () => {
    Object.assign(editData[1], mobEditData);
    setData({ ...data });
    setEditData(null);
  };

  const deleteMob = (vnum) => {
    if (!window.confirm("Delete Mob #" + vnum + "?")) {
      return;
    }
    data.mobs = data.mobs.filter((mob) => mob.vnum !== vnum);
    data.rooms.forEach((room) => {
      if (room.resets) {
        room.resets = room.resets.filter((reset) => reset.type !== "mob" || reset.vnum !== vnum);
      }
    });
    setData({ ...data });
    setEditData(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        width: 600,
        top: 58,
        bottom: 0,
        right: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        backgroundColor: "black",
        padding: 20,
      }}
      key={Date.now()}
    >
      <form>
        <IconButton variant="contained" onClick={() => setEditData(null)} style={{ float: "right" }}>
          <CancelIcon color="secondary"></CancelIcon>
        </IconButton>
        Mob #{mobEditData.vnum}
        <TextField
          id="mob-name"
          label="Name"
          variant="outlined"
          defaultValue={mobEditData?.name}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            mobEditData.name = e.target.value;
          }}
        />
        <TextField
          id="mob-short_description"
          label="Short Description"
          variant="outlined"
          defaultValue={mobEditData?.short_description}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            mobEditData.short_description = e.target.value;
          }}
        />
        <TextField
          id="mob-long_description"
          label="Long Description"
          variant="outlined"
          defaultValue={mobEditData?.long_description}
          style={{ width: "100%", marginBottom: 15 }}
          onChange={(e) => {
            mobEditData.long_description = e.target.value;
          }}
        />
        <IconButton
          variant="contained"
          onClick={() => {
            mobEditData.description = formatTextArea("mob-description");
          }}
          style={{ float: "right" }}
        >
          <WrapTextIcon color="secondary"></WrapTextIcon>
        </IconButton>
        <TextareaAutosize
          minRows={5}
          placeholder="Description"
          defaultValue={mobEditData.description}
          onChange={(e) => {
            mobEditData.description = e.target.value;
          }}
          style={{ width: "100%", marginBottom: 15 }}
          id="mob-description"
        />
        <div style={{ textAlign: "left", clear: "both" }}>
          <Button
            variant="contained"
            color="secondary"
            style={{ marginRight: 5 }}
            onClick={() => deleteMob(mobEditData.vnum)}
          >
            Delete Mob
          </Button>
          <div style={{ float: "right" }}>
            <Button variant="contained" color="primary" style={{ marginRight: 15 }} onClick={updateMob}>
              Update
            </Button>
            <Button variant="contained" onClick={() => setEditData(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ExitForm({ data, setData, setEditData, editData }) {
  const dir = editData[3];
  const room = editData[2];
  const exitData = editData[1];

  const exitEditData = React.useMemo(() => ({ flags: [], to: null, keyword: null, ...exitData }), [exitData]);

  const acceptAndReciprocate = () => {
    var toRoom = data.rooms.find((room) => room.vnum === exitEditData.to);
    if (toRoom === undefined) {
      alert("Unable to find to-room " + exitEditData.to);
    } else {
      Object.assign(exitData, exitEditData);
      room.exits[dir] = { ...exitEditData };
      const rev = dirInfo[dir].rev;
      if (!(rev in toRoom.exits)) {
        toRoom.exits[rev] = { ...exitEditData };
      } else {
        Object.assign(toRoom.exits[rev], exitEditData);
      }
      toRoom.exits[rev].to = room.vnum;
      setEditData(null);
    }
    setData({ ...data });
  };

  const deleteExit = () => {
    if (!window.confirm("Delete This Exit?")) {
      return;
    }
    var toRoom = data.rooms.find((room) => room.vnum === exitEditData.to);
    if (toRoom !== undefined) {
      const rev = dirInfo[dir].rev;
      delete toRoom.exits[rev];
    }
    delete room.exits[dir];
    setData({ ...data });
    setEditData(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        width: 600,
        top: 58,
        bottom: 0,
        right: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        backgroundColor: "black",
        padding: 20,
      }}
      key={Date.now()}
    >
      <form>
        <IconButton variant="contained" onClick={() => setEditData(null)} style={{ float: "right" }}>
          <CancelIcon color="secondary"></CancelIcon>
        </IconButton>
        <h2>
          #{room.vnum} : {dir}
        </h2>
        <div>
          <TextField
            id="exit-to"
            label="To"
            variant="outlined"
            defaultValue={exitEditData?.to}
            style={{ width: "100%", marginBottom: 15 }}
            onChange={(e) => {
              exitEditData.to = parseInt(e.target.value);
            }}
          />
        </div>
        {exitEditData?.to && (
          <>
            <FormControl component="fieldset">
              <FormGroup>
                {exitFlags.map((flag) => (
                  <FormControlLabel
                    key={"exit-flag-" + flag}
                    control={
                      <Checkbox
                        defaultChecked={exitEditData.flags.includes(flag)}
                        onChange={(e) => {
                          exitEditData.flags = e.target.checked
                            ? exitEditData.flags.concat([e.target.name])
                            : exitEditData.flags.filter((i) => i !== e.target.name);
                        }}
                        name={flag}
                      />
                    }
                    label={flag}
                  />
                ))}
              </FormGroup>
            </FormControl>
            <TextField
              id="exit-keyword"
              label="Keyword"
              variant="outlined"
              defaultValue={exitEditData?.keyword}
              style={{ width: "100%", marginBottom: 15 }}
              onChange={(e) => {
                exitEditData.keyword = e.target.value;
              }}
            />
            <TextField
              id="exit-key"
              label="Key"
              variant="outlined"
              defaultValue={exitEditData?.key}
              style={{ width: "100%", marginBottom: 15 }}
              onChange={(e) => {
                exitEditData.key = parseInt(e.target.value);
              }}
            />
            <div style={{ textAlign: "left" }}>
              <Button variant="contained" color="secondary" style={{ marginRight: 15 }} onClick={deleteExit}>
                Delete
              </Button>
              <div style={{ float: "right" }}>
                <Button variant="contained" color="primary" style={{ marginRight: 15 }} onClick={acceptAndReciprocate}>
                  Update
                </Button>
                <Button variant="contained" onClick={() => setEditData(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function RoomForm({ data, setData, roomData, setEditData }) {
  const [updateEnabled, setUpdateEnabled] = React.useState(false);
  const [tab, setTab] = React.useState(0);
  const roomEditData = { ...roomData };

  React.useEffect(() => {
    setUpdateEnabled(false);
  }, [roomData]);

  const deleteRoom = (vnum) => {
    if (!window.confirm("Delete Room #" + vnum + "?")) {
      return;
    }
    setEditData(null);
    data.rooms = data.rooms.filter((room) => room.vnum !== vnum);
    data.rooms.forEach((room) => {
      room.exits = objFilter(room.exits, (dir, exit) => exit.to !== vnum);
    });
    setData({ ...data });
  };

  const resetName = (reset) => {
    if (reset.type === "mob") {
      const mob = data.mobs.find((mob) => reset.vnum === mob.vnum);
      if (mob) {
        return mob.short_description + " (mob #" + reset.vnum + ")";
      } else {
        return "mob #" + reset.vnum;
      }
    } else if (reset.type === "object") {
      const obj = data.objects.find((obj) => reset.vnum === obj.vnum);
      if (obj) {
        return obj.short_description + " (obj #" + reset.vnum + ")";
      } else {
        return "object #" + reset.vnum;
      }
    }
  };

  const renderNode = (node) => (
    <li>
      {resetName(node)}
      {node?.objects ? <ul>{node.objects.map(renderNode)}</ul> : null}
    </li>
  );

  return (
    <div
      style={{
        position: "absolute",
        width: 600,
        top: 58,
        bottom: 0,
        right: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        backgroundColor: "black",
        padding: 20,
      }}
      key={"room-" + roomEditData.vnum}
    >
      <IconButton variant="contained" onClick={() => setEditData(null)} style={{ float: "right" }}>
        <CancelIcon color="secondary"></CancelIcon>
      </IconButton>
      <Tabs value={tab} onChange={(e, val) => setTab(val)} textColor="secondary" indicatorColor="secondary">
        <Tab label="Room Data" id="room-edit-tab-0" />
        <Tab label="Resets" id="room-edit-tab-1" />
      </Tabs>
      <TabPanel style={{ display: tab === 1 ? "block" : "none" }}>
        <ul>{roomEditData?.resets ? roomEditData.resets.map(renderNode) : null}</ul>
      </TabPanel>
      <TabPanel style={{ display: tab === 0 ? "block" : "none" }}>
        <form>
          <h2 style={{ margin: 15, padding: 0 }}>Room #{roomEditData.vnum}</h2>
          <TextField
            id="room-name"
            label="Name"
            variant="outlined"
            defaultValue={roomEditData.name}
            style={{ width: "100%", marginBottom: 15 }}
            onChange={(e) => {
              roomEditData.name = e.target.value;
              setUpdateEnabled(true);
            }}
          />
          <IconButton
            variant="contained"
            onClick={() => {
              roomEditData.description = formatTextArea("roomDescription");
            }}
            style={{ float: "right" }}
          >
            <WrapTextIcon color="secondary"></WrapTextIcon>
          </IconButton>
          <TextareaAutosize
            minRows={5}
            placeholder="Description"
            defaultValue={roomEditData.description}
            onChange={(e) => {
              roomEditData.description = e.target.value;
              setUpdateEnabled(true);
            }}
            style={{ width: "100%", marginBottom: 15 }}
            id="roomDescription"
          />
          <FormControl style={{ width: "100%", marginBottom: 15 }}>
            <InputLabel id="room-sector">Sector</InputLabel>
            <Select
              labelId="Room Sector"
              id="room-selector"
              defaultValue={roomEditData.sector}
              onChange={(e) => {
                roomEditData.sector = e.target.value;
              }}
            >
              {Object.keys(sectors).map((sector) => (
                <MenuItem value={sector} key={"sector-" + sector}>
                  {sector}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="room-heal_rate"
            label="Heal Rate"
            variant="outlined"
            value={roomEditData.heal_rate}
            style={{ width: "100%", marginBottom: 15, marginTop: 15 }}
            onChange={(e) => {
              roomEditData.heal_rate = e.target.value;
              setUpdateEnabled(true);
            }}
          />
          <TextField
            id="room-mana_rate"
            label="Mana Rate"
            variant="outlined"
            value={roomEditData.mana_rate}
            style={{ width: "100%", marginBottom: 15 }}
            onChange={(e) => {
              roomEditData.mana_rate = e.target.value;
              setUpdateEnabled(true);
            }}
          />
          <FormControl component="fieldset">
            <FormGroup>
              {roomFlags.map((flag) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      defaultChecked={roomEditData.room_flags.includes(flag)}
                      onChange={(e) => {
                        roomEditData.room_flags = e.target.checked
                          ? roomEditData.room_flags.concat([e.target.name])
                          : roomEditData.room_flags.filter((i) => i !== e.target.name);
                        setUpdateEnabled(true);
                      }}
                      name={flag}
                      key={"room-flag-" + flag}
                    />
                  }
                  label={flag}
                />
              ))}
            </FormGroup>
          </FormControl>
          <div style={{ marginTop: 10 }}>
            <Button
              variant="contained"
              color="secondary"
              style={{ marginRight: 5 }}
              onClick={() => deleteRoom(roomData.vnum)}
            >
              Delete Room
            </Button>
            <div style={{ float: "right" }}>
              <Button variant="contained" style={{ marginRight: 5 }} onClick={() => setEditData(null)}>
                Cancel
              </Button>
              <Button
                disabled={!updateEnabled}
                variant="contained"
                color="primary"
                style={{ marginRight: 5 }}
                onClick={() => {
                  Object.assign(roomData, roomEditData);
                  setEditData(null);
                }}
              >
                Update
              </Button>
            </div>
          </div>
        </form>
      </TabPanel>
    </div>
  );
}

const AreaEdit = ({ data, setData }) => {
  const [updateEnabled, setUpdateEnabled] = React.useState(false);
  const areaEditData = { ...data };

  React.useEffect(() => {
    setUpdateEnabled(false);
  }, [data]);

  return (
    data?.rooms !== undefined && (
      <form key={data.name} style={{ padding: 30 }}>
        <div>
          <TextField
            id="area-name"
            label="Area Name"
            variant="outlined"
            defaultValue={areaEditData.name}
            style={{ width: 400, marginBottom: 15 }}
            onChange={(e) => {
              areaEditData.name = e.target.value;
              setUpdateEnabled(true);
            }}
          />
        </div>
        <div>
          <TextField
            id="area-name"
            label="Builders"
            variant="outlined"
            defaultValue={areaEditData.builders}
            style={{ width: 400, marginBottom: 15 }}
            onChange={(e) => {
              areaEditData.builders = e.target.value;
              setUpdateEnabled(true);
            }}
          />
        </div>
        <div>
          <TextField
            id="area-name"
            label="Credits"
            variant="outlined"
            defaultValue={areaEditData.credits}
            style={{ width: 400, marginBottom: 15 }}
            onChange={(e) => {
              areaEditData.credits = e.target.value;
              setUpdateEnabled(true);
            }}
          />
        </div>
        <div>
          <TextField
            id="area-name"
            label="Lower Vnum"
            variant="outlined"
            defaultValue={areaEditData.lower_vnum}
            style={{ width: 400, marginBottom: 15 }}
            onChange={(e) => {
              areaEditData.lower_vnum = parseInt(e.target.value);
              setUpdateEnabled(true);
            }}
          />
        </div>
        <div>
          <TextField
            id="area-name"
            label="Upper Vnum"
            variant="outlined"
            defaultValue={areaEditData.upper_vnum}
            style={{ width: 400, marginBottom: 15 }}
            onChange={(e) => {
              areaEditData.upper_vnum = parseInt(e.target.value);
              setUpdateEnabled(true);
            }}
          />
        </div>
        <div style={{ width: 400, textAlign: "right" }}>
          <Button
            disabled={!updateEnabled}
            variant="contained"
            color="primary"
            style={{ marginRight: 5 }}
            onClick={() => {
              setData(areaEditData);
              setUpdateEnabled(false);
            }}
          >
            Update Area
          </Button>
        </div>
      </form>
    )
  );
};

function FileMenu({ fileMenuOpen, setFileMenuOpen, anchorEl, setData, fileName, setFileName, profile, data }) {
  const [fileList, setFileList] = React.useState(null);
  const user = profile && profile.googleId;

  const saveFile = (fileName) => {
    fetch(awsEndpoint + "?area_action=put&user=" + encodeURIComponent(user) + "&file=" + encodeURIComponent(fileName))
      .then((res) => res.json())
      .then((res) => {
        fetch(res.url, { method: "PUT", body: JSON.stringify(data) }).then(() => setFileList(null));
      });
    setFileName(fileName);
    setFileMenuOpen(false);
  };

  const loadFile = (url, fileName) => {
    fetch(awsEndpoint + "?area_action=get&user=" + encodeURIComponent(user) + "&file=" + encodeURIComponent(fileName))
      .then((res) => res.json())
      .then((res) => {
        fetch(res.url)
          .then((res) => res.json())
          .then((res) => {
            setFileMenuOpen(false);
            setFileName(fileName);
            setData(res);
          });
      });
  };

  React.useEffect(() => {
    if (fileList == null) {
      fetch(awsEndpoint + "?area_action=list&user=" + encodeURIComponent(user))
        .then((res) => res.json())
        .then((res) => {
          setFileList(res.files);
        });
    }
  }, [user, fileList]);

  const saveAs = () => {
    var fileName = window.prompt("New file name");
    fileName = fileName.replace(/[^0-9a-z_-]/gi, "");
    if (fileName === "") {
      alert("BAD FILENAME");
      return;
    }
    if (!fileName.endsWith(".json")) {
      fileName = fileName + ".json";
    }
    saveFile(fileName);
  };

  const deleteFile = (fileName) => {
    if (!window.confirm("Delete " + fileName + " for forever?")) {
      return;
    }
    fetch(
      awsEndpoint +
        "?area_action=delete&user=" +
        encodeURIComponent(profile.googleId) +
        "&file=" +
        encodeURIComponent(fileName),
      { method: "POST" }
    ).then(() => setFileList(null));
  };

  return (
    <Popper open={fileMenuOpen} anchorEl={anchorEl} role={undefined} transition disablePortal>
      {({ TransitionProps, placement }) => (
        <Grow
          {...TransitionProps}
          style={{
            transformOrigin: placement === "bottom" ? "center top" : "center bottom",
          }}
        >
          <Paper>
            <ClickAwayListener onClickAway={() => setFileMenuOpen(false)}>
              <MenuList autoFocusItem={fileMenuOpen} id="menu-list-grow">
                <MenuItem onClick={() => saveFile(fileName)}>Save To Cloud</MenuItem>
                <MenuItem onClick={saveAs}>Save To Cloud As...</MenuItem>
                <MenuItem onClick={() => setFileList(null)}>Reload list</MenuItem>
                <hr />
                <div style={{ textAlign: "center" }}>
                  {fileList == null ? (
                    <CircularProgress />
                  ) : (
                    fileList.map((file) => (
                      <MenuItem
                        style={{ padding: 0, paddingRight: 10 }}
                        onClick={() => loadFile(file.url, file.filename)}
                      >
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFile(file.filename);
                          }}
                        >
                          <DeleteForeverIcon />
                        </IconButton>{" "}
                        {file.filename}
                      </MenuItem>
                    ))
                  )}
                </div>
              </MenuList>
            </ClickAwayListener>
          </Paper>
        </Grow>
      )}
    </Popper>
  );
}

function App() {
  const [data, setData] = React.useState({});
  const [fileName, setFileName] = React.useState(null);
  const [value, setValue] = React.useState(0);
  const [editData, setEditData] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [fileMenuAnchor, setFileMenuAnchor] = React.useState(null);
  const [fileMenuOpen, setFileMenuOpen] = React.useState(false);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  React.useEffect(() => {
    // data cleanup
    if (data && data?.rooms) {
      data.rooms = data.rooms.filter((room) => room.vnum);
      objForeach(data.rooms, (dir, room) => {
        objFilter(room, (key, value) => value && !isNaN(value));
      });
    }
    data?.rooms?.forEach((room) => {
      room.exits = objFilter(room.exits, (dir, exit) => exit && exit.to);
      objForeach(room.exits, (dir, exit) => {
        objFilter(exit, (key, value) => value && !isNaN(value));
      });
    });
  }, [data]);

  const addObject = () => {
    for (var i = data.lower_vnum; i < data.upper_vnum; i++) {
      const vnum = i;
      if (data.objects.find((object) => object.vnum === vnum) === undefined) {
        const newObject = {
          vnum: vnum,
          name: "object new",
          short_description: "a new object",
          description: "A brand new object is here.",
        };
        data.objects.push(newObject);
        setData({ ...data });
        setEditData(["obj", newObject]);
        return;
      }
    }
    alert("No vnums available.");
  };

  const addMobile = () => {
    for (var i = data.lower_vnum; i < data.upper_vnum; i++) {
      const vnum = i;
      if (data.mobs.find((mob) => mob.vnum === vnum) === undefined) {
        const newMob = {
          vnum: vnum,
          name: "mob new",
          short_description: "a new mob",
          long_description: "A brand new mob is here.",
          description: "This is a mob. It looks new.",
        };
        data.mobs.push(newMob);
        setData({ ...data });
        setEditData(["mob", newMob]);
        return;
      }
    }
    alert("No vnums available.");
  };

  React.useEffect(() => {
    const initClient = () => {
      gapi.client.init({
        clientId: googleClientId,
        scope:
          "email profile https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/userinfo.profile",
      });
    };
    gapi.load("client:auth2", initClient);
  }, []);

  return (
    <>
      <input
        accept=".json"
        style={{ display: "none" }}
        id="upload-area-file"
        name="upload-area-file"
        type="file"
        onChange={(e) => {
          var reader = new FileReader();
          reader.onload = (e) => {
            var data = JSON.parse(e.target.result);
            initialPos(data?.rooms || []);
            setData(data);
          };
          reader.readAsText(e.target.files[0]);
          setFileName(e.target.value.split("\\").pop().split("/").pop());
        }}
      />
      <div style={{ float: "right", padding: 8 }}>
        <Tooltip title="New Area">
          <IconButton
            variant="contained"
            onClick={() => {
              if (window.confirm("Create New Area?")) {
                setData({
                  rooms: [],
                  mobs: [],
                  objects: [],
                  lower_vnum: 100,
                  upper_vnum: 199,
                  security: 9,
                  open: false,
                  flags: [],
                  min_level: 100,
                });
                setFileName("area.json");
              }
            }}
          >
            <NoteAdd color="secondary" />
          </IconButton>
        </Tooltip>
        <label htmlFor="upload-area-file">
          <Tooltip title="Upload Area File">
            <IconButton color="secondary" variant="contained" component="span">
              <InsertDriveFileIcon></InsertDriveFileIcon>
              <ArrowUpwardIcon
                style={{
                  position: "absolute",
                  margin: "auto",
                  color: "black",
                  fontSize: 15,
                  marginTop: 5,
                }}
              />
            </IconButton>
          </Tooltip>
        </label>
        <Tooltip title="Download Area File">
          <IconButton variant="contained" onClick={() => download(JSON.stringify(data), fileName, "application/json")}>
            <SaveAltIcon color="secondary" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Online Files">
          <IconButton
            variant="contained"
            onClick={(e) => {
              setFileMenuAnchor(e.target);
              setFileMenuOpen(!fileMenuOpen);
            }}
            disabled={!profile}
          >
            <CloudUploadIcon color={profile ? "secondary" : "disabled"} />
          </IconButton>
        </Tooltip>
        <GoogleLogin
          clientId={googleClientId}
          buttonText={profile ? profile.email : "Sign in with Google"}
          onSuccess={(res) => setProfile(res.profileObj)}
          onFailure={(err) => console.log(err)}
          cookiePolicy={"single_host_origin"}
          profile={true}
          isSignedIn={true}
        />
      </div>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Area" id="simple-tab-0" />
          <Tab label="Rooms" id="simple-tab-1" />
          <Tab label="Mobs" id="simple-tab-2" />
          <Tab label="Objects" id="simple-tab-3" />
        </Tabs>
      </Box>
      <div style={{ position: "absolute", left: 0, top: 58, bottom: 0, right: 0 }}>
        <TabPanel value={value} index={0}>
          <AreaEdit data={data} setData={setData} />
        </TabPanel>

        <TabPanel value={value} index={1}>
          {data?.rooms && <AreaEditor data={data} setData={setData} setEditData={setEditData} editData={editData} />}
          <div style={{ position: "absolute", left: 10, top: 0, color: "black" }}>
            {data?.name} - {fileName}
          </div>
        </TabPanel>

        <TabPanel value={value} index={2} style={{ paddingLeft: 15 }}>
          <Button
            variant="contained"
            disabled={Object.keys(data).length === 0}
            color="secondary"
            startIcon={<PersonAddIcon />}
            onClick={addMobile}
          >
            New Mob
          </Button>
          <TableContainer>
            <Table style={{ width: 800 }}>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Vnum</StyledTableCell>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell align="right">Level</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.mobs &&
                  data.mobs.map((mob) => (
                    <StyledTableRow key={"mob-card-" + mob.vnum} onClick={() => setEditData(["mob", mob])}>
                      <StyledTableCell component="th" scope="row">
                        {mob.vnum}
                      </StyledTableCell>
                      <StyledTableCell component="th" scope="row">
                        {mob.short_description}
                      </StyledTableCell>
                      <StyledTableCell align="right">{mob.level}</StyledTableCell>
                    </StyledTableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={value} index={3} style={{ paddingLeft: 15 }}>
          <Button
            variant="contained"
            disabled={Object.keys(data).length === 0}
            color="secondary"
            startIcon={<PostAddIcon />}
            onClick={addObject}
          >
            New Object
          </Button>
          <TableContainer>
            <Table style={{ width: 800 }}>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Vnum</StyledTableCell>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell align="right">Level</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.objects &&
                  data.objects.map((object) => (
                    <StyledTableRow key={"object-card-" + object.vnum} onClick={() => setEditData(["obj", object])}>
                      <StyledTableCell component="th" scope="row">
                        {object.vnum}
                      </StyledTableCell>
                      <StyledTableCell component="th" scope="row">
                        {object.short_description}
                      </StyledTableCell>
                      <StyledTableCell align="right">{object.level}</StyledTableCell>
                    </StyledTableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </div>
      {editData && editData[0] === "room" && (
        <RoomForm data={data} setData={setData} roomData={editData[1]} setEditData={setEditData} />
      )}
      {editData && editData[0] === "exit" && (
        <ExitForm data={data} setData={setData} setEditData={setEditData} editData={editData} />
      )}
      {editData && editData[0] === "mob" && (
        <MobForm data={data} setData={setData} setEditData={setEditData} editData={editData} />
      )}
      {editData && editData[0] === "obj" && (
        <ObjectForm data={data} setData={setData} setEditData={setEditData} editData={editData} />
      )}
      <FileMenu
        setFileMenuOpen={setFileMenuOpen}
        fileMenuOpen={fileMenuOpen}
        anchorEl={fileMenuAnchor}
        setData={setData}
        profile={profile}
        fileName={fileName}
        setFileName={setFileName}
        data={data}
      />
    </>
  );
}

export default App;
