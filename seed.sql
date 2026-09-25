INSERT INTO categoria (nombre, descripcion, estado) VALUES
  ('Cuidado facial', 'Limpieza, hidratación y tratamientos para el rostro', true),
  ('Maquillaje', 'Color y acabado para el día a día o una ocasión especial', true),
  ('Cuidado capilar', 'Shampoos, tratamientos y productos de peinado', true)
ON CONFLICT DO NOTHING;

INSERT INTO producto (id_categoria, nombre, descripcion, precio, estado_activo) VALUES
  (1, 'Limpiador Facial Espuma Suave 150ml', 'Limpieza diaria para piel sensible, libre de sulfatos.', 65.00, true),
  (1, 'Crema Hidratante Día y Noche 50g', 'Hidratación profunda con ácido hialurónico.', 89.00, true),
  (1, 'Sérum Vitamina C 30ml', 'Ilumina y unifica el tono de la piel.', 145.00, true),
  (2, 'Base Líquida Cobertura Media 30ml', 'Acabado natural, 12 tonos disponibles.', 120.00, true),
  (2, 'Paleta de Sombras Tonos Tierra', '12 tonos mate y shimmer.', 98.00, true),
  (2, 'Labial Mate Larga Duración', 'Fórmula libre de resequedad.', 55.00, true),
  (3, 'Shampoo Reparador 400ml', 'Repara puntas abiertas y fortalece la fibra capilar.', 72.00, true),
  (3, 'Aceite Capilar Argán 60ml', 'Brillo y control del frizz sin apelmazar.', 95.00, true),
  (3, 'Mascarilla Capilar Nutritiva 300ml', 'Tratamiento semanal intensivo.', 80.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO inventario (id_producto, cantidad_disponible)
SELECT id_producto, (10 + (id_producto * 3) % 15) FROM producto
ON CONFLICT (id_producto) DO NOTHING;

-- Un producto deliberadamente agotado, para poder ejecutar CP-22 (visible + agotado) en vivo.
UPDATE inventario SET cantidad_disponible = 0 WHERE id_producto = 3;
