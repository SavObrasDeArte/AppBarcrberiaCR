import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, getAdditionalUserInfo, ProviderId } from "firebase/auth";
import {
  getFirestore, Timestamp,
  collection, doc, getDoc, getDocs, query, onSnapshot, updateDoc, setDoc, addDoc, deleteDoc,
  orderBy, where,
} from "firebase/firestore";
import moment from "moment";
import Toastify from 'toastify-js'
import "toastify-js/src/toastify.css"

const arrayDias = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"]

//SERVICE WORKER
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js') // Ruta relativa al Service Worker
        .then(registration => {
          console.log('Service Worker registrado con éxito:', registration);
        })
        .catch(error => {
          console.error('Error al registrar el Service Worker:', error);
        });
    });
  } else {
    console.log('Los service workers no son soportados en este navegador.');
  }
}
registerServiceWorker()


const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG)

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const showNotification = ({ text = "Exito", duration = 1500, gravity = "top", position = "left" }) => {
  Toastify({
    text,
    duration,
    newWindow: true,
    close: true,
    gravity, // `top` or `bottom`
    position, // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    style: {
      background: "linear-gradient(to right, #2C682E, #96c93d)",
    },
    onClick: function () { } // Callback after click
  }).showToast();
}

const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    return alert(error.message);
  }
}

const _setUserProperties = async ({ nameValue, nroValue }) => {
  console.log(nameValue, nroValue)
  await updateProfile(auth.currentUser, {
    displayName: nameValue,
  })
}


const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    return userCredential.user;
  } catch (error) {
    return alert(error.message);
  }
}

//signOut(auth)

const getUserInfo = async () => {
  const userInfo = JSON.parse(localStorage.getItem("USER_INFO"))
  if (userInfo)
    return {
      name: userInfo.name,
      email: userInfo.email,
      nro: userInfo.nro
    }

  const docSnap = await getDoc(doc(db, "clientes", auth.currentUser.email))
  localStorage.setItem("USER_INFO", JSON.stringify({
    name: docSnap.data().name,
    email: docSnap.data().email,
    nro: docSnap.data().nro
  }))
  return {
    name: docSnap.data().name,
    email: docSnap.data().email,
    nro: docSnap.data().nro
  }
}

const getReserve = async (isDateAfterNowBy30Min) => {
  const docSnap = await getDoc(doc(db, "clientes", auth.currentUser.email))
  if (docSnap.exists) {
    const docTime = {
      time: docSnap.data().reserve.time.toDate(),
      id: docSnap.data().reserve.id
    }
    if (isDateAfterNowBy30Min(docTime.time))
      return docTime
    else
      return null
  }
}

const getHistory = async () => {
  const q = query(collection(db, "clientes", auth.currentUser.email, "history"), orderBy("time", "desc"))
  const docsSnap = await getDocs(q)
  return docsSnap
}

const getClientes = async () => {
  const docsSnap = await getDocs(collection(db, "clientes"))
  return docsSnap
}

const getTurnos = async (setTurnosList, setOpenLoading, pickUpDate) => {
  const dayNamePicked = arrayDias[moment(pickUpDate.split("/").reverse().join("-")).format("d")].toLowerCase()
  setOpenLoading(true)
  const unsub = onSnapshot(collection(db, "turnos", dayNamePicked, "turnos"), query => {
    setTurnosList(query.docs)
    setOpenLoading(false)
  })

  return unsub
}

const getReserves = async (setOpenLoading, pickUpDate) => {
  const dayNamePicked = arrayDias[moment(pickUpDate.split("/").reverse().join("-")).format("d")].toLowerCase()
  setOpenLoading(true)
  const docsSnap = await getDocs(collection(db, "turnos", dayNamePicked, "turnos"))
  setOpenLoading(false)
  return docsSnap
}

const getDays = async () => {
  const localDays = localStorage.getItem("DAYS_INFO")
  const q = query(collection(db, "turnos"), orderBy("index"))
  return localDays || await getDocs(q)
}



const putReserve = async ({ isAdmin, arrayDias, pickUpDate, time, reserveId, reserveInfoAdmin }) => {
  const dayNamePicked = arrayDias[moment(pickUpDate.split("/").reverse().join("-")).format("d")].toLowerCase()
  const hour = moment(time).format("HH")
  const minute = moment(time).format("mm")
  const timeMoment = moment(pickUpDate.split("/").toReversed().join("-")).hours(hour).minutes(minute).format()
  const recipientEmail = isAdmin ? /*reserveInfoAdmin.infoConfirmReserve*/ "" : auth.currentUser.email
  const timestamp = Timestamp.fromDate(new Date(timeMoment))
  const reserveObj =
    isAdmin
      ? {
        reserve: {
          email: /*reserveInfoAdmin.infoConfirmReserve*/ "",
          name: reserveInfoAdmin.infoConfirmReserve.reserveName,
          time: Timestamp.fromDate(new Date(
            moment(pickUpDate.split("/").toReversed().join("-"))
              .hours(hour)
              .minutes(minute)
              .format()
          ))
        }
      }
      : {
        reserve: {
          email: auth.currentUser.email,
          name: auth.currentUser.displayName,
          time: Timestamp.fromDate(new Date(timeMoment))
        }
      }
  const localStorageReserveObj = JSON.stringify({
    time: timeMoment,
    id: reserveId
  })

  try {
    if (isAdmin) {
      console.log(dayNamePicked, reserveId, reserveObj)
      await updateDoc(doc(db, "turnos", dayNamePicked, "turnos", reserveId), reserveObj)

      showNotification({ text: "Reservado", gravity: "bottom", position: "center" })
    } else {
      await updateDoc(doc(db, "clientes", recipientEmail), {
        reserve: {
          time: timestamp,
          id: reserveId
        },
      })
      await setDoc(doc(db, "clientes", recipientEmail, "history", reserveId), {
        time: timestamp,
        id: reserveId
      })
      localStorage.setItem("RESERVE", localStorageReserveObj)
    }
  }
  catch (error) {
    console.log(error)
  }
}

const putState = async ({ arrayDias, pickUpDate, reserveId, stateInfo, action, oldState }) => {
  let active = []
  let desactive = []
  const dayNamePicked = arrayDias[moment(pickUpDate.split("/").reverse().join("-")).format("d")].toLowerCase()
  const timeMoment = moment(pickUpDate.split("/").toReversed().join("-")).format()
  const timestamp = Timestamp.fromDate(new Date(timeMoment))

  switch (stateInfo.type) {
    case "una":
      if (action == "activating") {
        if (oldState.desactive[0] == "siempre") {
          active = [...oldState.active, timestamp]
          desactive = ["siempre"]
        } else {
          const timePickedFormated = moment(pickUpDate.split("/").toReversed().join("-")).format("DD:MM:YYYY")
          oldState.desactive = oldState.desactive.filter(time => moment(time.toDate()).format("DD:MM:YYYY") != timePickedFormated)

          active = ["siempre"]
          desactive = [...oldState.desactive]
        }
      } else {
        if (oldState.desactive[0] == "siempre") {
          const timePickedFormated = moment(pickUpDate.split("/").toReversed().join("-"))
          oldState.active = oldState.active.filter(time => moment(time.toDate()).isSame(timePickedFormated, "d"))

          active = [...oldState.active]
          desactive = ["siempre"]
        } else {
          active = ["siempre"]
          desactive = [...oldState.desactive, timestamp]
        }
      }
      break
    case "siempre":
      if (action == "activating") {
        active = ["siempre"]
        desactive = []
      } else {
        active = []
        desactive = ["siempre"]
      }
      break
    case "semana":

      let weeksTimestamp = []
      for (let i = 0, time = moment(timeMoment); i < stateInfo.weeksAmount; i++) {
        weeksTimestamp.push(Timestamp.fromDate(new Date(time)))
        time.add(7, "days")
      }

      if (action == "activating") {
        if (oldState.desactive[0] == "siempre") {
          active = [...oldState.active, ...weeksTimestamp]
          desactive = ["siempre"]
        } else {
          let auxDesactive = []
          oldState.desactive.forEach(timeDesactive => {
            const isWeekSameDesactivate = weeksTimestamp.some(time => moment(time.toDate()).isSame(moment(timeDesactive.toDate()), "d"))
            if (!isWeekSameDesactivate) auxDesactive.push(timeDesactive)
          })

          active = ["siempre"]
          desactive = [...auxDesactive]
        }
      } else {
        //esta hecho asi sin pensar
        if (oldState.desactive[0] == "siempre") {
          let auxActive = []
          oldState.active.forEach(timeActive => {
            const isWeekSameActivate = weeksTimestamp.some(time => moment(time.toDate()).isSame(moment(timeActive.toDate()), "d"))
            if (!isWeekSameActivate) auxActive.push(timeActive)
          })

          active = [...auxActive]
          desactive = ["siempre"]
        } else {
          active = ["siempre"]
          desactive = [...oldState.desactive, ...weeksTimestamp]
        }
      }

      break
    default:
      return
  }

  const state = {
    state: {
      active,
      desactive
    }
  }
  const docRef = doc(db, "turnos", dayNamePicked, "turnos", reserveId)
  await updateDoc(docRef, state)
}


const removeReserve = async ({ arrayDias, reserveDate }) => {
  const dayNamePicked = arrayDias[moment(reserveDate.time.split("/").reverse().join("-")).format("d")].toLowerCase()
  const timeMoment = moment().utcOffset("-03:00").subtract(1, 'days').format()

  try {
    await updateDoc(doc(db, "turnos", dayNamePicked, "turnos", reserveDate.id), {
      reserve: {
        time: Timestamp.fromDate(new Date(timeMoment))
      }
    })
    await updateDoc(doc(db, "clientes", auth.currentUser.email), {
      reserve: {},
    })
    await deleteDoc(doc(db, "clientes", auth.currentUser.email, "history", reserveDate.id))
    localStorage.setItem("RESERVE", JSON.stringify({
      time: timeMoment,
      id: null
    }))

    showNotification({ text: "Reserva Cancelada", duration: 2500 })
  }
  catch (error) {
    console.log(error)
  }

}



export {
  app, db, auth,
  showNotification,
  signIn, signUp,
  _setUserProperties,
  getReserve, getTurnos, getReserves, getUserInfo, getHistory, getClientes, getDays,
  putReserve, putState,
  removeReserve
}