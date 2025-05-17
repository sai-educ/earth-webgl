import * as THREE from 'three';

THREE.OrbitControls = function ( object, domElement ) {
	this.object = object;
	this.domElement = domElement;

	// API
	this.enabled = true;
	this.target = new THREE.Vector3();
	this.minDistance = 0;
	this.maxDistance = Infinity;
	this.minPolarAngle = 0;
	this.maxPolarAngle = Math.PI;
	this.enableDamping = false;
	this.dampingFactor = 0.05;
	this.enableZoom = true;
	this.zoomSpeed = 1.0;
	this.enableRotate = true;
	this.rotateSpeed = 1.0;
	this.enablePan = true;
	this.keyPanSpeed = 7.0;
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0;
	this.enableKeys = true;
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Internals
	var scope = this;
	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var EPS = 0.000001;
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();
	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	var pointers = [];
	var lastPosition = new THREE.Vector3();

	var state = THREE.CONTROL_NONE;

	// Update method
	this.update = function () {
		var position = scope.object.position;
		var offset = position.clone().sub( scope.target );

		offset.applyQuaternion( new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) ) );
		spherical.setFromVector3( offset );

		if ( scope.autoRotate && state === THREE.CONTROL_NONE ) {
			sphericalDelta.theta -= scope.autoRotateSpeed;
		}

		if ( scope.enableDamping ) {
			spherical.theta += sphericalDelta.theta * scope.dampingFactor;
			spherical.phi += sphericalDelta.phi * scope.dampingFactor;
		} else {
			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;
		}

		spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );
		spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

		spherical.radius *= scale;
		spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

		scope.target.add( panOffset );
		offset.setFromSpherical( spherical );
		offset.applyQuaternion( new THREE.Quaternion().setFromUnitVectors( new THREE.Vector3( 0, 1, 0 ), object.up ) );
		position.copy( scope.target ).add( offset );
		scope.object.lookAt( scope.target );

		if ( scope.enableDamping ) {
			sphericalDelta.theta *= ( 1 - scope.dampingFactor );
			sphericalDelta.phi *= ( 1 - scope.dampingFactor );
		} else {
			sphericalDelta.set( 0, 0, 0 );
		}

		scale = 1;
		panOffset.set( 0, 0, 0 );

		if ( zoomChanged || lastPosition.distanceToSquared( scope.object.position ) > EPS ) {
			scope.dispatchEvent( changeEvent );
			lastPosition.copy( scope.object.position );
			zoomChanged = false;
			return true;
		}

		return false;
	};

	// Event handlers
	var onPointerDown = function ( event ) {
		if ( scope.enabled === false ) return;
		if ( pointers.length === 0 ) {
			scope.domElement.setPointerCapture( event.pointerId );
			scope.domElement.addEventListener( 'pointermove', onPointerMove );
			document.addEventListener( 'pointerup', onPointerUp );
		}
		addPointer( event );
		scope.dispatchEvent( startEvent );
	};

	var onPointerMove = function ( event ) {
		if ( scope.enabled === false ) return;
		getPointer( event );
		if ( pointers.length === 1 ) {
			var pointer = getPointer( event );
			if ( state === THREE.CONTROL_ROTATE ) {
				if ( scope.enableRotate === false ) return;
				rotateEnd.set( pointer.x, pointer.y );
				rotateDelta.subVectors( rotateEnd, rotateStart );
				var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
				sphericalDelta.theta -= 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed;
				sphericalDelta.phi -= 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed;
				rotateStart.copy( rotateEnd );
				scope.update();
			} else if ( state === THREE.CONTROL_PAN ) {
				if ( scope.enablePan === false ) return;
				panEnd.set( pointer.x, pointer.y );
				panDelta.subVectors( panEnd, panStart );
				pan( panDelta.x, panDelta.y );
				panStart.copy( panEnd );
				scope.update();
			}
		}
	};

	var onPointerUp = function ( event ) {
		if ( scope.enabled === false ) return;
		removePointer( event );
		if ( pointers.length === 0 ) {
			scope.domElement.releasePointerCapture( event.pointerId );
			scope.domElement.removeEventListener( 'pointermove', onPointerMove );
			document.removeEventListener( 'pointerup', onPointerUp );
		}
		scope.dispatchEvent( endEvent );
		state = THREE.CONTROL_NONE;
	};

	var onMouseWheel = function ( event ) {
		if ( scope.enabled === false || scope.enableZoom === false ) return;
		var delta = 0;
		if ( event.wheelDelta !== undefined ) {
			delta = event.wheelDelta;
		} else if ( event.detail !== undefined ) {
			delta = - event.detail;
		}
		scale += delta * 0.05;
		if ( scale < 1 ) {
			scale = 1;
		} else if ( scale > 3 ) {
			scale = 3;
		}
		zoomChanged = true;
		scope.update();
	};

	// Helper functions
	var getPointer = function ( event ) {
		return { x: ( event.clientX / window.innerWidth ) * 2 - 1, y: - ( event.clientY / window.innerHeight ) * 2 + 1 };
	};

	var addPointer = function ( event ) {
		pointers.push( event );
	};

	var removePointer = function ( event ) {
		for ( var i = 0; i < pointers.length; i ++ ) {
			if ( pointers[ i ].pointerId == event.pointerId ) {
				pointers.splice( i, 1 );
				break;
			}
		}
	};

	var pan = function ( deltaX, deltaY ) {
		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
		var halfWidth = element.clientWidth / 2;
		var halfHeight = element.clientHeight / 2;
		panOffset.x += deltaX * ( spherical.radius / halfHeight ) * scope.panSpeed;
		panOffset.y += deltaY * ( spherical.radius / halfHeight ) * scope.panSpeed;
	};

	// Initialize
	this.domElement.addEventListener( 'pointerdown', onPointerDown );
	this.domElement.addEventListener( 'wheel', onMouseWheel );
	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); } );

	this.handleResize();
};
