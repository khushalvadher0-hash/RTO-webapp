// Firestore backend connectivity check
import { db } from "./src/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function checkBackend() {
  try {
    console.log("--- REGISTRY_SERVICES_V2 ---");
    const sCol = collection(db, "registry_services_v2");
    const sSnap = await getDocs(sCol);
    sSnap.docs.forEach((doc) => {
      console.log(`ID: ${doc.id}, ServiceType: ${doc.data().serviceType || doc.data().serviceName}, VehicleId: ${doc.data().vehicleId}`);
    });

    console.log("--- REGISTRY_TASKS ---");
    const tCol = collection(db, "registry_tasks");
    const tSnap = await getDocs(tCol);
    tSnap.docs.forEach((doc) => {
      console.log(`ID: ${doc.id}, Title: ${doc.data().title}`);
    });
  } catch (err) {
    console.error("❌ Backend connection error:", err);
  }
}

checkBackend();
