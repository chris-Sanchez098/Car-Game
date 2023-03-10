import * as THREE from 'three';
import { renderMap } from './renderMap';
import { arcCenterX, chooseRandom, trackRadius } from './utils';
import { Car, Truck } from './vehicles';

// html elements
const scoreElement = document.getElementById('score');
const buttonsElement = document.getElementById('buttons');
const instructionsElement = document.getElementById('instructions');
const resultsElement = document.getElementById('results');
const accelerateButton = document.getElementById('accelerate');
const decelerateButton = document.getElementById('decelerate');

// const to game logic
const playerAngleInitial = Math.PI;
const speed = 0.0017;
const config = {
	showHitZones: false,
	shadows: true, // Use shadow
	trees: true, // Add trees to the map
	curbs: true, // Show texture on the extruded geometry
	grid: false, // Show grid helper
};

// let to game logic

let ready;
let playerAngleMoved;
let score;
let otherVehicles = [];
let lastTimestamp;
let accelerate = false; // Is the player accelerating
let decelerate = false; // Is the player decelerating

const scene = new THREE.Scene();
if (config.grid) {
	const gridHelper = new THREE.GridHelper(80, 8);
	gridHelper.rotation.x = Math.PI / 2;
	scene.add(gridHelper);
}
// add car
const playerCar = Car();
scene.add(playerCar);

// lights
const ambientLights = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLights);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(100, -300, 300);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -400;
dirLight.shadow.camera.right = 350;
dirLight.shadow.camera.top = 400;
dirLight.shadow.camera.bottom = -300;
dirLight.shadow.camera.near = 100;
dirLight.shadow.camera.far = 800;
scene.add(dirLight);

// camera
const aspectRadio = window.innerWidth / window.innerHeight;
const cameraWidth = 960;
const cameraHeight = cameraWidth / aspectRadio;

const camera = new THREE.OrthographicCamera(
	cameraWidth / -2, // left
	cameraWidth / 2, // right
	cameraHeight / 2, // top
	cameraHeight / -2, // bottom
	50, // near plane
	700 // far plane
);
camera.position.set(0, -210, 300);
camera.lookAt(0, 0, 0);

// map and render
const { plane, fieldMesh } = renderMap(cameraWidth, cameraHeight * 2);
scene.add(plane);
scene.add(fieldMesh);

const renderer = new THREE.WebGLRenderer({
	antialias: true,
	powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
if (config.shadows) renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// speeds

const getPlayerSpeed = () => {
	if (accelerate) return speed * 2;
	if (decelerate) return speed * 0.5;
	return speed;
};

const getVehicleSpeed = type => {
	if (type === 'car') {
		const minimumSpeed = 1;
		const maximumSpeed = 2;
		return minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed);
	}
	if (type === 'truck') {
		const minimumSpeed = 0.6;
		const maximumSpeed = 1.5;
		return minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed);
	}
};

// movements

const movePlayerCar = timeDelta => {
	const playerSpeed = getPlayerSpeed();
	playerAngleMoved -= playerSpeed * timeDelta;

	const totalPlayerAngle = playerAngleInitial + playerAngleMoved;

	const playerX = Math.cos(totalPlayerAngle) * trackRadius - arcCenterX;
	const playerY = Math.sin(totalPlayerAngle) * trackRadius;

	playerCar.position.x = playerX;
	playerCar.position.y = playerY;

	playerCar.rotation.z = totalPlayerAngle - Math.PI / 2;
};

const moveOtherVehicles = timeDelta => {
	otherVehicles.forEach(vehicle => {
		if (vehicle.clockwise) {
			vehicle.angle -= speed * timeDelta * vehicle.speed;
		} else {
			vehicle.angle += speed * timeDelta * vehicle.speed;
		}

		const vehicleX = Math.cos(vehicle.angle) * trackRadius + arcCenterX;
		const vehicleY = Math.sin(vehicle.angle) * trackRadius;
		const rotation =
			vehicle.angle + (vehicle.clockwise ? -Math.PI / 2 : Math.PI / 2);
		vehicle.mesh.position.x = vehicleX;
		vehicle.mesh.position.y = vehicleY;
		vehicle.mesh.rotation.z = rotation;
	});
};

// add vehicles

const addVehicle = () => {
	const vehicleTypes = ['car', 'truck'];

	const type = chooseRandom(vehicleTypes);
	const speed = getVehicleSpeed(type);
	const clockwise = Math.random() >= 0.5;

	const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;

	const mesh = type === 'car' ? Car() : Truck();
	scene.add(mesh);

	otherVehicles.push({ mesh, type, speed, clockwise, angle });
};

// hit detention

const getHitZonePosition = (center, angle, clockwise, distance) => {
	const directionAngle = angle + clockwise ? -Math.PI / 2 : +Math.PI / 2;
	return {
		x: center.x + Math.cos(directionAngle) * distance,
		y: center.y + Math.sin(directionAngle) * distance,
	};
};

const getDistance = (coordinate1, coordinate2) => {
	const horizontalDistance = coordinate2.x - coordinate1.x;
	const verticalDistance = coordinate2.y - coordinate1.y;
	return Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2);
};

const hitDetection = () => {
	const playerHitZone1 = getHitZonePosition(
		playerCar.position,
		playerAngleInitial + playerAngleMoved,
		true,
		15
	);

	const playerHitZone2 = getHitZonePosition(
		playerCar.position,
		playerAngleInitial + playerAngleMoved,
		true,
		-15
	);

	if (config.showHitZones) {
		playerCar.userData.hitZone1.position.x = playerHitZone1.x;
		playerCar.userData.hitZone1.position.y = playerHitZone1.y;

		playerCar.userData.hitZone2.position.x = playerHitZone2.x;
		playerCar.userData.hitZone2.position.y = playerHitZone2.y;
	}

	const hit = otherVehicles.some(vehicle => {
		if (vehicle.type === 'car') {
			const vehicleHitZone1 = getHitZonePosition(
				vehicle.mesh.position,
				vehicle.angle,
				vehicle.clockwise,
				15
			);

			const vehicleHitZone2 = getHitZonePosition(
				vehicle.mesh.position,
				vehicle.angle,
				vehicle.clockwise,
				-15
			);

			if (config.showHitZones) {
				vehicle.mesh.userData.hitZone1.position.x = vehicleHitZone1.x;
				vehicle.mesh.userData.hitZone1.position.y = vehicleHitZone1.y;

				vehicle.mesh.userData.hitZone2.position.x = vehicleHitZone2.x;
				vehicle.mesh.userData.hitZone2.position.y = vehicleHitZone2.y;
			}

			// The player hits another vehicle
			if (getDistance(playerHitZone1, vehicleHitZone1) < 40) return true;
			if (getDistance(playerHitZone1, vehicleHitZone2) < 40) return true;

			// Another vehicle hits the player
			if (getDistance(playerHitZone2, vehicleHitZone1) < 40) return true;
		}

		if (vehicle.type === 'truck') {
			const vehicleHitZone1 = getHitZonePosition(
				vehicle.mesh.position,
				vehicle.angle,
				vehicle.clockwise,
				35
			);

			const vehicleHitZone2 = getHitZonePosition(
				vehicle.mesh.position,
				vehicle.angle,
				vehicle.clockwise,
				0
			);

			const vehicleHitZone3 = getHitZonePosition(
				vehicle.mesh.position,
				vehicle.angle,
				vehicle.clockwise,
				-35
			);

			if (config.showHitZones) {
				vehicle.mesh.userData.hitZone1.position.x = vehicleHitZone1.x;
				vehicle.mesh.userData.hitZone1.position.y = vehicleHitZone1.y;

				vehicle.mesh.userData.hitZone2.position.x = vehicleHitZone2.x;
				vehicle.mesh.userData.hitZone2.position.y = vehicleHitZone2.y;

				vehicle.mesh.userData.hitZone3.position.x = vehicleHitZone3.x;
				vehicle.mesh.userData.hitZone3.position.y = vehicleHitZone3.y;
			}

			// The player hits another vehicle
			if (getDistance(playerHitZone1, vehicleHitZone1) < 40) return true;
			if (getDistance(playerHitZone1, vehicleHitZone2) < 40) return true;
			if (getDistance(playerHitZone1, vehicleHitZone3) < 40) return true;

			// Another vehicle hits the player
			if (getDistance(playerHitZone2, vehicleHitZone1) < 40) return true;
		}
		return false;
	});

	if (hit) {
		if (resultsElement) resultsElement.style.display = 'flex';
		renderer.setAnimationLoop(null); // Stop animation loop
	}
};

// animation

const animation = timestamp => {
	if (!lastTimestamp) {
		lastTimestamp = timestamp;
		return;
	}

	const timeDelta = timestamp - lastTimestamp;

	movePlayerCar(timeDelta);

	const laps = Math.floor(Math.abs(playerAngleMoved) / (Math.PI * 2));

	// Update score if it changed
	if (laps !== score) {
		score = laps;
		scoreElement.innerText = score;
	}

	// Add a new vehicle at the beginning and with every 5th lap
	if (otherVehicles.length < (laps + 1) / 5) addVehicle();

	moveOtherVehicles(timeDelta);

	hitDetection();

	renderer.render(scene, camera);
	lastTimestamp = timestamp;
};

// reset

const positionScoreElement = () => {
	const arcCenterXinPixels = (arcCenterX / cameraWidth) * window.innerWidth;
	scoreElement.style.cssText = `
	  left: ${window.innerWidth / 2 - arcCenterXinPixels * 1.3}px;
	  top: ${window.innerHeight / 2}px
	`;
};

const startGame = () => {
	if (ready) {
		ready = false;
		scoreElement.innerText = 0;
		buttonsElement.style.opacity = 1;
		instructionsElement.style.opacity = 0;
		renderer.setAnimationLoop(animation);
	}
};

const reset = () => {
	// Reset position and score
	playerAngleMoved = 0;
	score = 0;
	scoreElement.innerText = 'Presiona arriba';

	// Remove other vehicles
	otherVehicles.forEach(vehicle => {
		// Remove the vehicle from the scene
		scene.remove(vehicle.mesh);

		// If it has hit-zone helpers then remove them as well
		if (vehicle.mesh.userData.hitZone1)
			scene.remove(vehicle.mesh.userData.hitZone1);
		if (vehicle.mesh.userData.hitZone2)
			scene.remove(vehicle.mesh.userData.hitZone2);
		if (vehicle.mesh.userData.hitZone3)
			scene.remove(vehicle.mesh.userData.hitZone3);
	});
	otherVehicles = [];

	resultsElement.style.display = 'none';

	lastTimestamp = undefined;

	// Place the player's car to the starting position
	movePlayerCar(0);

	// Render the scene
	renderer.render(scene, camera);

	positionScoreElement();

	ready = true;
};

// listeners

window.addEventListener('keydown', function (event) {
	if (event.key === 'ArrowUp') {
		startGame();
		accelerate = true;
		return;
	}
	if (event.key === 'ArrowDown') {
		decelerate = true;
		return;
	}
	if (event.key === 'R' || event.key === 'r') {
		reset();
	}
});
window.addEventListener('keyup', function (event) {
	if (event.key === 'ArrowUp') {
		accelerate = false;
		return;
	}
	if (event.key === 'ArrowDown') {
		decelerate = false;
	}
});

accelerateButton.addEventListener('mousedown', () => {
	startGame();
	accelerate = true;
});
decelerateButton.addEventListener('mousedown', () => {
	startGame();
	decelerate = true;
});
accelerateButton.addEventListener('mouseup', () => {
	accelerate = false;
});
decelerateButton.addEventListener('mouseup', () => {
	decelerate = false;
});

// initial game

reset();

setTimeout(() => {
	if (ready) instructionsElement.style.opacity = 1;
	buttonsElement.style.opacity = 1;
}, 4000);
