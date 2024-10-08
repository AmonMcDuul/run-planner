import { CommonModule } from '@angular/common';
import { Component, ElementRef, signal, ViewChild, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { latLng, marker, tileLayer, Map, Marker, LatLng } from 'leaflet';
import 'leaflet-routing-machine';

interface SavedRoute {
  name: string;
  waypoints: LatLng[];
  distance: number;
  estimatedTime: number;
}

declare var L: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [LeafletModule, CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  
  @ViewChild('routeItinerary', { static: false }) routeItineraryRef!: ElementRef;

  map!: Map;
  markers: Marker[] = [];
  routeControl: any;
  distance = signal(0);
  estimatedTime = signal(0);
  savedRoutes: SavedRoute[] = [];
  routeName = '';
  inputError = false;
  selectedRouteName = 'New route';

  options = {
    layers: [
      tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '...' })
    ],
    zoom: 15,
    center: latLng(51.5314342, 4.2700376)
  };

  layersControl = {
    baseLayers: {
      'Open Street Map': tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '...' }),
      'Open Cycle Map': tileLayer('https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '...' })
    }
  }

  greenIcon = L.icon({
    iconUrl: 'https://leafletjs.com/examples/custom-icons/leaf-red.png',
    shadowUrl: 'https://leafletjs.com/examples/custom-icons/leaf-shadow.png',
    iconSize: [38, 95],
    shadowSize: [50, 64],
    iconAnchor: [22, 94],
    shadowAnchor: [4, 62],
    popupAnchor: [-3, -76]
  });

  ngOnInit() {
    this.loadRoutes();
  }

  onMapReady(map: Map) {
    this.map = map;
    this.map.on('click', (e) => this.addMarker(e.latlng));
  }

  addMarker(latlng: L.LatLng) {
    const newMarker = marker(latlng, { draggable: true, icon: this.greenIcon }).addTo(this.map);
    this.markers.push(newMarker);

    newMarker.on('dragend', () => {
      this.updateRoute();
    });

    newMarker.on('click', () => {
      this.removeMarker(newMarker);
    });

    if (this.markers.length > 1) {
      this.updateRoute();
    }
  }

  removeMarker(marker: Marker) {
    this.map.removeLayer(marker);
    this.markers = this.markers.filter(m => m !== marker);
    this.updateRoute();
  }

  removeAllMarkers() {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.splice(0);
    this.updateRoute();
  }

  updateRoute() {
    this.selectedRouteName = 'New route';
    if (this.routeControl) {
      this.map.removeControl(this.routeControl);
    }

    if (this.markers.length > 1) {
      const waypoints = this.markers.map(m => m.getLatLng());

      this.routeControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        show: true,
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1/',
          profile: 'foot' 
          
        }),
      }).addTo(this.map);

      this.routeControl.on('routesfound', (e: any) => {
        this.distance.set(e.routes[0].summary.totalDistance);
        this.estimatedTime.set(e.routes[0].summary.totalTime);
      });

      const itineraryContainer = this.routeControl.getContainer();
      const itineraryDiv = this.routeItineraryRef.nativeElement;

      if (itineraryDiv && itineraryContainer) {
        itineraryDiv.appendChild(itineraryContainer);
      }
    } else {
      this.distance.set(0);
      this.estimatedTime.set(0);
    }
  }

  saveRoute() {
    if (this.routeName.trim() === '') {
      this.inputError = true;
      return;
    }

    const savedRoute: SavedRoute = {
      name: this.routeName,
      waypoints: this.markers.map(m => m.getLatLng()),
      distance: this.distance(),
      estimatedTime: this.estimatedTime()
    };

    this.savedRoutes.push(savedRoute);
    this.routeName = '';
    this.inputError = false;
    this.saveRoutesToLocalStorage();
  }

  restoreRoute(index: number) {
    this.removeAllMarkers();
    const route = this.savedRoutes[index];
    route.waypoints.forEach(latlng => this.addMarker(latlng));
    this.selectedRouteName = route.name;
  }

  deleteRoute(index: number) {
    this.savedRoutes.splice(index, 1);
    this.saveRoutesToLocalStorage();
  }

  loadRoutes() {
    const savedRoutes = localStorage.getItem('savedRoutes');
    if (savedRoutes) {
      this.savedRoutes = JSON.parse(savedRoutes);
    }
  }

  saveRoutesToLocalStorage() {
    localStorage.setItem('savedRoutes', JSON.stringify(this.savedRoutes));
  }

  metersToTime(meters: number, pace: number = 5) { 
    const kilometers = meters / 1000;
    const minutes = kilometers * pace;
    const hours = Math.floor(minutes / 60);
    let mins = Math.floor(minutes % 60);
    let secs = Math.round((minutes - mins - hours * 60) * 60);
  
    if (secs === 60) {
      mins += 1;
      secs = 0;
    }
  
    return `${hours ? hours + 'h ' : ''}${mins}m ${secs}s`;
  }
}
