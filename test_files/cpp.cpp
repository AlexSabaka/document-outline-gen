#include <iostream>
#include <vector>

namespace MyApp {
    /**
     * Base class for all entities
     */
    class Entity {
    public:
        Entity(int id) : m_id(id) {}
        virtual ~Entity() = default;
        
        virtual void update() = 0;
        int getId() const { return m_id; }
        
    protected:
        static int s_counter;
        
    private:
        int m_id;
    };
    
    template<typename T>
    class Container {
    public:
        void add(const T& item);
        size_t size() const;
        
    private:
        std::vector<T> m_items;
    };
    
}
    enum Status {
        ACTIVE,
        INACTIVE,
        PENDING
    };