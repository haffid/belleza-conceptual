# E10 — Matriz de pruebas implementadas

| ID | Escenario ejecutado | Capa |
| --- | --- | --- |
| UT-BE-01 | subtotal usa precio del servidor por cantidad | Backend |
| UT-BE-02 | total suma líneas de productos distintos | Backend |
| UT-BE-03 | cantidad cero se rechaza antes de persistir | Backend |
| UT-BE-04 | cantidad negativa se rechaza antes de persistir | Backend |
| UT-BE-05 | cantidad no numérica se rechaza antes de persistir | Backend |
| UT-BE-06 | pedido vacío se rechaza | Backend |
| UT-BE-07 | stock insuficiente simulado impide guardar el pedido | Backend |
| UT-BE-08 | cantidad igual al stock es aceptada | Backend |
| UT-BE-09 | producto agotado no genera un pedido | Backend |
| UT-BE-10 | líneas repetidas se consolidan antes de reservar | Backend |
| UT-BE-11 | un precio enviado por el cliente no altera el importe | Backend |
| UT-BE-12 | producto inexistente no permite persistir el pedido | Backend |
| UT-BE-13 | producto inactivo no se confirma | Backend |
| UT-BE-14 | fallo del repositorio se propaga sin confirmar ni guardar | Backend |
| UT-BE-15 | catálogo transforma centavos e imágenes del repositorio | Backend |
| UT-BE-16 | catálogo vacío devuelve una colección válida | Backend |
| UT-BE-17 | precio negativo se rechaza sin insertar un producto | Backend |
| UT-BE-18 | precio con tres decimales se rechaza | Backend |
| UT-BE-19 | producto válido conserva importe y registra inventario inicial | Backend |
| UT-BE-20 | una segunda cancelación no devuelve inventario otra vez | Backend |
| UT-BE-21 | adaptador reenvía consulta parametrizada al pool simulado | Backend |
| UT-BE-22 | transacción confirma y libera el cliente | Backend |
| UT-BE-23 | fallo del trabajo revierte y libera el cliente | Backend |
| UT-BE-24 | fallo al confirmar intenta rollback y libera el cliente | Backend |
| UT-BE-25 | cierre del adaptador cierra el pool una vez | Backend |
| UT-FE-01 | agregar producto crea una línea y persiste el carrito | Frontend |
| UT-FE-02 | agregar el mismo producto consolida la cantidad | Frontend |
| UT-FE-03 | agregar dos unidades actualiza cantidad y subtotal | Frontend |
| UT-FE-04 | quitar una línea conserva la otra y recalcula total | Frontend |
| UT-FE-05 | quitar la última línea vacía el carrito y su total | Frontend |
| UT-FE-06 | total acumula precio por cantidad de todas las líneas | Frontend |
| UT-FE-07 | agregar de nuevo no excede el stock comunicado | Frontend |
| UT-FE-08 | producto agotado no ofrece una acción de agregar | Frontend |
| UT-FE-09 | dirección obligatoria faltante impide enviar el pedido | Frontend |
| UT-FE-10 | fallo simulado del catálogo muestra el error | Frontend |
| UT-FE-11 | filtro de categoría conserva solo los productos elegidos | Frontend |
| UT-FE-12 | categoría sin productos muestra estado vacío | Frontend |
| UT-FE-13 | error al confirmar conserva carrito y reactiva el botón | Frontend |
| UT-FE-14 | confirmación exitosa vacía carrito y muestra código y total | Frontend |
