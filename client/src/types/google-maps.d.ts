// Type definitions for Google Maps JavaScript API
declare global {
  interface Window {
    google: typeof google;
  }

  namespace google {
    namespace maps {
      class Map {
        constructor(mapDiv: Element, opts?: MapOptions);
        setCenter(latLng: LatLng | LatLngLiteral): void;
        setZoom(zoom: number): void;
        setOptions(options: MapOptions): void;
        panTo(latLng: LatLng | LatLngLiteral): void;
        panBy(x: number, y: number): void;
        fitBounds(bounds: LatLngBounds | LatLngBoundsLiteral, padding?: number | Padding): void;
        getBounds(): LatLngBounds;
        getCenter(): LatLng;
        getZoom(): number;
        getDiv(): Element;
        getMapTypeId(): MapTypeId;
        setMapTypeId(mapTypeId: MapTypeId | string): void;
      }

      interface MapOptions {
        center?: LatLng | LatLngLiteral;
        zoom?: number;
        mapTypeId?: MapTypeId | string;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        zoomControl?: boolean;
        styles?: MapTypeStyle[];
      }

      interface MapTypeStyle {
        elementType?: string;
        featureType?: string;
        stylers: MapTypeStyler[];
      }

      interface MapTypeStyler {
        [key: string]: string | number | boolean;
      }

      interface LatLngLiteral {
        lat: number;
        lng: number;
      }

      interface LatLngBoundsLiteral {
        east: number;
        north: number;
        south: number;
        west: number;
      }

      interface Padding {
        bottom: number;
        left: number;
        right: number;
        top: number;
      }

      class LatLng {
        constructor(lat: number, lng: number, noWrap?: boolean);
        lat(): number;
        lng(): number;
        toString(): string;
        toUrlValue(precision?: number): string;
        toJSON(): LatLngLiteral;
        equals(other: LatLng): boolean;
      }

      class LatLngBounds {
        constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
        contains(latLng: LatLng | LatLngLiteral): boolean;
        equals(other: LatLngBounds | LatLngBoundsLiteral): boolean;
        extend(point: LatLng | LatLngLiteral): LatLngBounds;
        getCenter(): LatLng;
        getNorthEast(): LatLng;
        getSouthWest(): LatLng;
        isEmpty(): boolean;
        union(other: LatLngBounds | LatLngBoundsLiteral): LatLngBounds;
        toJSON(): LatLngBoundsLiteral;
        toString(): string;
        toUrlValue(precision?: number): string;
      }

      class Marker {
        constructor(opts?: MarkerOptions);
        setMap(map: Map | null): void;
        setPosition(latLng: LatLng | LatLngLiteral): void;
        setTitle(title: string): void;
        setLabel(label: string | MarkerLabel): void;
        setIcon(icon: string | Icon | Symbol): void;
        getPosition(): LatLng;
        getTitle(): string;
        getLabel(): MarkerLabel;
        getMap(): Map | null;
      }

      interface MarkerOptions {
        position: LatLng | LatLngLiteral;
        map?: Map;
        title?: string;
        icon?: string | Icon | Symbol;
        label?: string | MarkerLabel;
        draggable?: boolean;
        clickable?: boolean;
        animation?: Animation;
        visible?: boolean;
        zIndex?: number;
      }

      interface MarkerLabel {
        text: string;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        fontWeight?: string;
      }

      interface Icon {
        url: string;
        size?: Size;
        scaledSize?: Size;
        origin?: Point;
        anchor?: Point;
        labelOrigin?: Point;
      }

      class Point {
        constructor(x: number, y: number);
        x: number;
        y: number;
        equals(other: Point): boolean;
        toString(): string;
      }

      class Size {
        constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
        height: number;
        width: number;
        equals(other: Size): boolean;
        toString(): string;
      }

      class DirectionsService {
        route(request: DirectionsRequest, callback: (result: DirectionsResult | null, status: DirectionsStatus) => void): void;
      }

      interface DirectionsRequest {
        origin: string | LatLng | LatLngLiteral | Place;
        destination: string | LatLng | LatLngLiteral | Place;
        travelMode: TravelMode;
        transitOptions?: TransitOptions;
        drivingOptions?: DrivingOptions;
        unitSystem?: UnitSystem;
        waypoints?: DirectionsWaypoint[];
        optimizeWaypoints?: boolean;
        provideRouteAlternatives?: boolean;
        avoidFerries?: boolean;
        avoidHighways?: boolean;
        avoidTolls?: boolean;
        region?: string;
      }

      interface DirectionsWaypoint {
        location: string | LatLng | LatLngLiteral | Place;
        stopover?: boolean;
      }

      interface Place {
        location: LatLng | LatLngLiteral;
        placeId: string;
        query: string;
      }

      interface DirectionsResult {
        routes: DirectionsRoute[];
      }

      interface DirectionsRoute {
        bounds: LatLngBounds;
        copyrights: string;
        fare?: TransitFare;
        legs: DirectionsLeg[];
        overview_path: LatLng[];
        overview_polyline: string;
        warnings: string[];
        waypoint_order: number[];
      }

      interface DirectionsLeg {
        arrival_time?: Time;
        departure_time?: Time;
        distance?: Distance;
        duration?: Duration;
        duration_in_traffic?: Duration;
        end_address: string;
        end_location: LatLng;
        start_address: string;
        start_location: LatLng;
        steps: DirectionsStep[];
        via_waypoints: LatLng[];
      }

      interface DirectionsStep {
        distance: Distance;
        duration: Duration;
        end_location: LatLng;
        instructions: string;
        path: LatLng[];
        start_location: LatLng;
        travel_mode: TravelMode;
        transit?: TransitDetails;
      }

      interface Distance {
        text: string;
        value: number;
      }

      interface Duration {
        text: string;
        value: number;
      }

      interface Time {
        text: string;
        time_zone: string;
        value: Date;
      }

      interface TransitDetails {
        arrival_stop: TransitStop;
        arrival_time: Time;
        departure_stop: TransitStop;
        departure_time: Time;
        headsign: string;
        headway: number;
        line: TransitLine;
        num_stops: number;
      }

      interface TransitStop {
        location: LatLng;
        name: string;
      }

      interface TransitLine {
        agencies: TransitAgency[];
        color: string;
        icon: string;
        name: string;
        short_name: string;
        text_color: string;
        url: string;
        vehicle: TransitVehicle;
      }

      interface TransitAgency {
        name: string;
        phone: string;
        url: string;
      }

      interface TransitVehicle {
        icon: string;
        local_icon: string;
        name: string;
        type: VehicleType;
      }

      interface TransitFare {
        currency: string;
        value: number;
        text: string;
      }

      interface TransitOptions {
        arrivalTime?: Date;
        departureTime?: Date;
        modes?: TransitMode[];
        routingPreference?: TransitRoutePreference;
      }

      interface DrivingOptions {
        departureTime: Date;
        trafficModel?: TrafficModel;
      }

      enum TrafficModel {
        BEST_GUESS = 'bestguess',
        OPTIMISTIC = 'optimistic',
        PESSIMISTIC = 'pessimistic',
      }

      enum TransitMode {
        BUS = 'bus',
        RAIL = 'rail',
        SUBWAY = 'subway',
        TRAIN = 'train',
        TRAM = 'tram',
      }

      enum TransitRoutePreference {
        FEWER_TRANSFERS = 'fewer_transfers',
        LESS_WALKING = 'less_walking',
      }

      enum UnitSystem {
        IMPERIAL = 0,
        METRIC = 1,
      }

      enum VehicleType {
        BUS = 'bus',
        CABLE_CAR = 'cable_car',
        COMMUTER_TRAIN = 'commuter_train',
        FERRY = 'ferry',
        FUNICULAR = 'funicular',
        GONDOLA_LIFT = 'gondola_lift',
        HEAVY_RAIL = 'heavy_rail',
        HIGH_SPEED_TRAIN = 'high_speed_train',
        INTERCITY_BUS = 'intercity_bus',
        METRO_RAIL = 'metro_rail',
        MONORAIL = 'monorail',
        OTHER = 'other',
        RAIL = 'rail',
        SHARE_TAXI = 'share_taxi',
        SUBWAY = 'subway',
        TRAM = 'tram',
        TROLLEYBUS = 'trolleybus',
      }

      class DirectionsRenderer {
        constructor(opts?: DirectionsRendererOptions);
        setDirections(directions: DirectionsResult | null): void;
        setMap(map: Map | null): void;
        setOptions(options: DirectionsRendererOptions): void;
        setPanel(panel: Element | null): void;
        setRouteIndex(routeIndex: number): void;
        getDirections(): DirectionsResult | null;
        getMap(): Map | null;
        getPanel(): Element | null;
        getRouteIndex(): number;
      }

      interface DirectionsRendererOptions {
        directions?: DirectionsResult;
        draggable?: boolean;
        hideRouteList?: boolean;
        infoWindow?: InfoWindow;
        map?: Map;
        markerOptions?: MarkerOptions;
        panel?: Element | null;
        polylineOptions?: PolylineOptions;
        preserveViewport?: boolean;
        routeIndex?: number;
        suppressBicyclingLayer?: boolean;
        suppressInfoWindows?: boolean;
        suppressMarkers?: boolean;
        suppressPolylines?: boolean;
      }

      interface PolylineOptions {
        clickable?: boolean;
        draggable?: boolean;
        editable?: boolean;
        geodesic?: boolean;
        icons?: IconSequence[];
        map?: Map;
        path?: LatLng[] | LatLngLiteral[] | MVCArray<LatLng>;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        visible?: boolean;
        zIndex?: number;
      }

      interface IconSequence {
        icon: Symbol;
        offset?: string;
        repeat?: string;
      }

      class Symbol {
        constructor(opts: SymbolOptions);
      }

      interface SymbolOptions {
        anchor?: Point;
        fillColor?: string;
        fillOpacity?: number;
        labelOrigin?: Point;
        path: SymbolPath | string;
        rotation?: number;
        scale?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
      }

      enum SymbolPath {
        BACKWARD_CLOSED_ARROW = 3,
        BACKWARD_OPEN_ARROW = 4,
        CIRCLE = 0,
        FORWARD_CLOSED_ARROW = 1,
        FORWARD_OPEN_ARROW = 2,
      }

      class MVCArray<T> {
        constructor(array?: T[]);
        clear(): void;
        forEach(callback: (elem: T, i: number) => void): void;
        getArray(): T[];
        getAt(i: number): T;
        getLength(): number;
        insertAt(i: number, elem: T): void;
        pop(): T;
        push(elem: T): number;
        removeAt(i: number): T;
        setAt(i: number, elem: T): void;
      }

      class InfoWindow {
        constructor(opts?: InfoWindowOptions);
        close(): void;
        getContent(): string | Element;
        getPosition(): LatLng | null;
        getZIndex(): number;
        open(map: Map | StreetViewPanorama, anchor?: MVCObject): void;
        setContent(content: string | Element): void;
        setOptions(options: InfoWindowOptions): void;
        setPosition(position: LatLng | LatLngLiteral): void;
        setZIndex(zIndex: number): void;
      }

      interface InfoWindowOptions {
        content?: string | Element;
        disableAutoPan?: boolean;
        maxWidth?: number;
        pixelOffset?: Size;
        position?: LatLng | LatLngLiteral;
        zIndex?: number;
      }

      class MVCObject {
        addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
        bindTo(key: string, target: MVCObject, targetKey?: string, noNotify?: boolean): void;
        get(key: string): any;
        notify(key: string): void;
        set(key: string, value: any): void;
        setValues(values: { [key: string]: any }): void;
        unbind(key: string): void;
        unbindAll(): void;
      }

      interface MapsEventListener {
        remove(): void;
      }

      class Geocoder {
        geocode(
          request: GeocoderRequest,
          callback: (results: GeocoderResult[], status: GeocoderStatus) => void
        ): void;
      }

      interface GeocoderRequest {
        address?: string;
        bounds?: LatLngBounds | LatLngBoundsLiteral;
        componentRestrictions?: GeocoderComponentRestrictions;
        location?: LatLng | LatLngLiteral;
        placeId?: string;
        region?: string;
      }

      interface GeocoderComponentRestrictions {
        administrativeArea?: string;
        country?: string | string[];
        locality?: string;
        postalCode?: string;
        route?: string;
      }

      interface GeocoderResult {
        address_components: GeocoderAddressComponent[];
        formatted_address: string;
        geometry: GeocoderGeometry;
        partial_match: boolean;
        place_id: string;
        postcode_localities?: string[];
        types: string[];
      }

      interface GeocoderAddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }

      interface GeocoderGeometry {
        bounds?: LatLngBounds;
        location: LatLng;
        location_type: GeocoderLocationType;
        viewport: LatLngBounds;
      }

      enum GeocoderLocationType {
        APPROXIMATE = 'APPROXIMATE',
        GEOMETRIC_CENTER = 'GEOMETRIC_CENTER',
        RANGE_INTERPOLATED = 'RANGE_INTERPOLATED',
        ROOFTOP = 'ROOFTOP',
      }

      enum GeocoderStatus {
        ERROR = 'ERROR',
        INVALID_REQUEST = 'INVALID_REQUEST',
        OK = 'OK',
        OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
        REQUEST_DENIED = 'REQUEST_DENIED',
        UNKNOWN_ERROR = 'UNKNOWN_ERROR',
        ZERO_RESULTS = 'ZERO_RESULTS',
      }

      enum TravelMode {
        BICYCLING = 'BICYCLING',
        DRIVING = 'DRIVING',
        TRANSIT = 'TRANSIT',
        WALKING = 'WALKING',
      }

      enum DirectionsStatus {
        INVALID_REQUEST = 'INVALID_REQUEST',
        MAX_WAYPOINTS_EXCEEDED = 'MAX_WAYPOINTS_EXCEEDED',
        NOT_FOUND = 'NOT_FOUND',
        OK = 'OK',
        OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
        REQUEST_DENIED = 'REQUEST_DENIED',
        UNKNOWN_ERROR = 'UNKNOWN_ERROR',
        ZERO_RESULTS = 'ZERO_RESULTS',
      }

      enum MapTypeId {
        HYBRID = 'hybrid',
        ROADMAP = 'roadmap',
        SATELLITE = 'satellite',
        TERRAIN = 'terrain',
      }

      enum Animation {
        BOUNCE = 1,
        DROP = 2,
        Ac = 3,
        Bc = 4,
      }

      class StreetViewPanorama extends MVCObject {
        constructor(container: Element, opts?: StreetViewPanoramaOptions);
      }

      interface StreetViewPanoramaOptions {
        addressControl?: boolean;
        addressControlOptions?: StreetViewAddressControlOptions;
        clickToGo?: boolean;
        disableDefaultUI?: boolean;
        disableDoubleClickZoom?: boolean;
        enableCloseButton?: boolean;
        fullscreenControl?: boolean;
        fullscreenControlOptions?: FullscreenControlOptions;
        imageDateControl?: boolean;
        linksControl?: boolean;
        motionTracking?: boolean;
        motionTrackingControl?: boolean;
        motionTrackingControlOptions?: MotionTrackingControlOptions;
        panControl?: boolean;
        panControlOptions?: PanControlOptions;
        pano?: string;
        position?: LatLng | LatLngLiteral;
        pov?: StreetViewPov;
        scrollwheel?: boolean;
        showRoadLabels?: boolean;
        visible?: boolean;
        zoom?: number;
        zoomControl?: boolean;
        zoomControlOptions?: ZoomControlOptions;
      }

      interface StreetViewAddressControlOptions {
        position: ControlPosition;
      }

      interface FullscreenControlOptions {
        position: ControlPosition;
      }

      interface MotionTrackingControlOptions {
        position: ControlPosition;
      }

      interface PanControlOptions {
        position: ControlPosition;
      }

      interface ZoomControlOptions {
        position: ControlPosition;
      }

      interface StreetViewPov {
        heading: number;
        pitch: number;
      }

      enum ControlPosition {
        BOTTOM_CENTER = 11,
        BOTTOM_LEFT = 10,
        BOTTOM_RIGHT = 12,
        LEFT_BOTTOM = 6,
        LEFT_CENTER = 4,
        LEFT_TOP = 5,
        RIGHT_BOTTOM = 9,
        RIGHT_CENTER = 8,
        RIGHT_TOP = 7,
        TOP_CENTER = 2,
        TOP_LEFT = 1,
        TOP_RIGHT = 3,
      }
    }
  }
}

export {};